"""
BlueVision Dakhla – AI proof of concept.

1. Pre-trains a compact U-Net on synthetic Sentinel-2-like scenes (4 bands: B2, B3, B4, B8)
2. Evaluates on a large held-out scene never seen in training
3. Exports the pitch visuals: raw image | segmentation mask | overlay, + metrics + training curve

Run (CPU is fine, ~5-10 min):
    python train_unet.py --steps 900 --out outputs
"""
import argparse
import json
import shutil
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from synth import make_scene, true_color
from unet import UNet, dice_loss

torch.set_num_threads(max(1, torch.get_num_threads()))


def build_pool(n, size, seed=0):
    """Pre-generate scenes once (generation is slower than a CPU training step)."""
    rng = np.random.default_rng(seed)
    return [make_scene(size, size, seed=int(rng.integers(1e9))) for _ in range(n)]


def batch(rng, pool, n, size):
    xs, ys = [], []
    for _ in range(n):
        full, fm = pool[rng.integers(len(pool))]
        H = full.shape[1]
        y0, x0 = rng.integers(0, H - size + 1, 2)
        img, m = full[:, y0:y0 + size, x0:x0 + size], fm[y0:y0 + size, x0:x0 + size]
        k = int(rng.integers(4))
        img, m = np.rot90(img, k, axes=(1, 2)), np.rot90(m, k)
        if rng.random() < 0.5:
            img, m = img[:, :, ::-1], m[:, ::-1]
        if rng.random() < 0.5:
            img, m = img[:, ::-1], m[::-1]
        xs.append(img.copy()); ys.append(m.copy()[None])
    return torch.from_numpy(np.stack(xs)), torch.from_numpy(np.stack(ys))


def normalise(x):
    # reflectance -> roughly zero-centred inputs
    return (x - 0.1) / 0.15


@torch.no_grad()
def predict(model, img):
    model.eval()
    x = normalise(torch.from_numpy(img)[None])
    h, w = img.shape[1:]
    ph, pw = (-h) % 8, (-w) % 8
    x = F.pad(x, (0, pw, 0, ph), mode="reflect")
    p = torch.sigmoid(model(x))[0, 0, :h, :w].numpy()
    return p


def metrics(prob, mask, thr=0.5):
    pred = prob > thr
    gt = mask > 0.5
    tp = (pred & gt).sum(); fp = (pred & ~gt).sum(); fn = (~pred & gt).sum(); tn = (~pred & ~gt).sum()
    return {
        "iou": float(tp / (tp + fp + fn + 1e-9)),
        "dice": float(2 * tp / (2 * tp + fp + fn + 1e-9)),
        "precision": float(tp / (tp + fp + 1e-9)),
        "recall": float(tp / (tp + fn + 1e-9)),
        "accuracy": float((tp + tn) / pred.size),
    }


def save_visuals(img, prob, mask, out: Path, tag: str):
    rgb = true_color(img)
    pred = prob > 0.5
    # mask image: dark ocean, bloom in hot colour scaled by probability
    m = np.zeros((*pred.shape, 3), np.uint8)
    m[...] = (8, 18, 31)
    hot = np.array([244, 63, 94], np.float32)
    m[pred] = (hot * np.clip(prob[pred][:, None] * 1.1, 0.6, 1)).astype(np.uint8)
    # overlay
    ov = rgb.astype(np.float32)
    a = (pred * 0.55)[..., None]
    ov = (ov * (1 - a) + hot * a).astype(np.uint8)
    # contour
    edge = pred ^ np.roll(pred, 1, 0) | pred ^ np.roll(pred, 1, 1)
    edge[0, :] = edge[-1, :] = False; edge[:, 0] = edge[:, -1] = False  # no wrap-around line
    ov[edge] = (255, 230, 120)
    gtv = np.zeros_like(m); gtv[...] = (8, 18, 31); gtv[mask > 0.5] = (63, 211, 232)

    Image.fromarray(rgb).save(out / f"{tag}_raw.png")
    Image.fromarray(m).save(out / f"{tag}_mask.png")
    Image.fromarray(ov).save(out / f"{tag}_overlay.png")
    Image.fromarray(gtv).save(out / f"{tag}_groundtruth.png")
    gap = np.full((rgb.shape[0], 12, 3), 255, np.uint8)
    Image.fromarray(np.concatenate([rgb, gap, m, gap, ov], 1)).save(out / f"{tag}_triptych.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=900)
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--size", type=int, default=96)
    ap.add_argument("--pool", type=int, default=400)
    ap.add_argument("--out", default="outputs")
    ap.add_argument("--export-frontend", default="../frontend/public/ai")
    args = ap.parse_args()

    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(0)
    rng = np.random.default_rng(0)
    model = UNet(in_ch=4, base=16)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=args.steps)
    print(f"U-Net: {n_params/1e6:.2f} M parameters")

    # fixed validation set
    print(f"generating {args.pool} synthetic scenes ...")
    pool = build_pool(args.pool, 160)
    val = [make_scene(192, 192, seed=10_000 + i) for i in range(8)]
    history = []
    t0 = time.time()
    for step in range(1, args.steps + 1):
        model.train()
        x, y = batch(rng, pool, args.batch, args.size)
        logits = model(normalise(x))
        loss = F.binary_cross_entropy_with_logits(logits, y) + dice_loss(logits, y)
        opt.zero_grad(); loss.backward(); opt.step(); sched.step()
        if step % 50 == 0 or step == 1:
            ious = [metrics(predict(model, im), m)["iou"] for im, m in val]
            history.append({"step": step, "loss": float(loss), "val_iou": float(np.mean(ious))})
            print(f"step {step:4d}  loss {loss.item():.3f}  val IoU {np.mean(ious):.3f}  ({time.time()-t0:.0f}s)")

    torch.save(model.state_dict(), out / "unet_hab.pt")

    # ---- held-out showcase scene (large, never seen) ----
    img, mask = make_scene(512, 512, seed=2026, bloom=True, land=True, clouds=True)
    prob = predict(model, img)
    m = metrics(prob, mask)
    save_visuals(img, prob, mask, out, "showcase")

    # test-set metrics on 20 unseen scenes
    test = [metrics(predict(model, im), mk) for im, mk in (make_scene(256, 256, seed=50_000 + i) for i in range(20))]
    agg = {k: float(np.mean([t[k] for t in test])) for k in test[0]}
    report = {
        "model": "U-Net (4 niveaux, 16 filtres de base)",
        "params_millions": round(n_params / 1e6, 2),
        "bands": ["B2 bleu", "B3 vert", "B4 rouge", "B8 PIR"],
        "train_steps": args.steps,
        "train_seconds": round(time.time() - t0),
        "showcase": m,
        "test_20_scenes": agg,
        "history": history,
    }
    (out / "metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps({"showcase": m, "test": agg}, indent=2))

    # copy visuals to the dashboard
    dst = Path(args.export_frontend)
    if dst.parent.exists():
        dst.mkdir(parents=True, exist_ok=True)
        for f in ["showcase_raw.png", "showcase_mask.png", "showcase_overlay.png", "showcase_triptych.png",
                  "showcase_groundtruth.png", "metrics.json"]:
            shutil.copy(out / f, dst / f)
        print("exported visuals to", dst)


if __name__ == "__main__":
    main()
