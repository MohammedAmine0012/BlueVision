"""
Run the BlueVision U-Net on a REAL satellite image (e.g. a Sentinel-2 true-colour export
from the Copernicus Browser: https://browser.dataspace.copernicus.eu).

    python segment_real.py --rgb my_sentinel2_truecolor.png [--nir my_B08.png] [--finetune]

--finetune : adapts the synthetic-pretrained network to the real scene in ~1-2 min using
             spectral-index pseudo-labels (a standard weak-supervision trick when no
             hand-labelled masks exist). Without it, the pretrained weights are used as-is.

Outputs <name>_raw.png / _mask.png / _overlay.png / _triptych.png in --out.
"""
import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from scipy.ndimage import binary_opening, binary_closing

from unet import UNet, dice_loss
from train_unet import normalise, predict, save_visuals


def to_reflectance(rgb_u8, gain=3.2, gamma=0.8):
    """Invert the true-colour stretch used by Sentinel Hub / our exporter (approximate)."""
    x = (rgb_u8.astype(np.float32) / 255.0) ** (1 / gamma) / gain
    return x  # (H, W, 3) = B4, B3, B2


def load_bands(rgb_path, nir_path=None, max_side=1024):
    im = Image.open(rgb_path).convert("RGB")
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side))
    rgb = np.asarray(im)
    refl = to_reflectance(rgb)
    B4, B3, B2 = refl[..., 0], refl[..., 1], refl[..., 2]
    if nir_path:
        nir = Image.open(nir_path).convert("L").resize(im.size)
        B8 = to_reflectance(np.asarray(nir)[..., None].repeat(3, -1))[..., 0]
    else:
        # crude NIR proxy when only true colour is available
        B8 = np.clip(0.9 * B4 + 0.4 * (B3 - B2), 0, 1)
    return np.stack([B2, B3, B4, B8]).astype(np.float32)


def pseudo_labels(img):
    """Spectral-index weak labels: water pixels whose green/red rise and blue drops (chl-a / red tide)."""
    B2, B3, B4, B8 = img
    bright = (B2 + B3 + B4) / 3
    water = (bright < 0.15) & (B4 < B3 * 1.6)            # excludes clouds and desert sand
    bloom_idx = (B3 - B2) / (B3 + B2 + 1e-6)              # green-blue normalised difference
    thr = np.percentile(bloom_idx[water], 85) if water.any() else 1
    lab = water & (bloom_idx > max(thr, -0.05))
    lab = binary_closing(binary_opening(lab, iterations=1), iterations=2)
    return lab.astype(np.float32), water


def finetune(model, img, lab, steps=150, crop=96):
    opt = torch.optim.AdamW(model.parameters(), lr=5e-4)
    rng = np.random.default_rng(0)
    H, W = lab.shape
    for s in range(steps):
        xs, ys = [], []
        for _ in range(8):
            y0 = rng.integers(0, max(1, H - crop)); x0 = rng.integers(0, max(1, W - crop))
            xs.append(img[:, y0:y0 + crop, x0:x0 + crop]); ys.append(lab[None, y0:y0 + crop, x0:x0 + crop])
        x = normalise(torch.from_numpy(np.stack(xs))); y = torch.from_numpy(np.stack(ys))
        model.train()
        logits = model(x)
        loss = F.binary_cross_entropy_with_logits(logits, y) + dice_loss(logits, y)
        opt.zero_grad(); loss.backward(); opt.step()
        if s % 50 == 0:
            print(f"finetune {s:3d} loss {loss.item():.3f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rgb", required=True)
    ap.add_argument("--nir")
    ap.add_argument("--weights", default="outputs/unet_hab.pt")
    ap.add_argument("--finetune", action="store_true")
    ap.add_argument("--out", default="outputs")
    args = ap.parse_args()

    img = load_bands(args.rgb, args.nir)
    model = UNet(in_ch=4, base=16)
    model.load_state_dict(torch.load(args.weights, map_location="cpu"))
    lab, water = pseudo_labels(img)
    if args.finetune:
        finetune(model, img, lab)
    prob = predict(model, img)
    prob[~water] *= 0.2  # never flag clouds/land with high confidence
    out = Path(args.out); out.mkdir(exist_ok=True, parents=True)
    tag = Path(args.rgb).stem
    save_visuals(img, prob, lab, out, tag)
    print(f"bloom coverage: {(prob > 0.5).mean()*100:.1f}% of the scene  ->  {out}/{tag}_triptych.png")


if __name__ == "__main__":
    main()
