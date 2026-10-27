"""Synthetic Sentinel-2-like ocean scenes with harmful algal bloom filaments.

Used to pre-train the U-Net when no labelled HAB archive is at hand (48 h hackathon).
Each scene has 4 bands (B2, B3, B4, B8) in reflectance units and a binary bloom mask.
Hard negatives are included on purpose: clouds, sun glint, turbid coastal water and desert land,
so the network has to learn the *spectral signature* of the bloom, not just "bright = bloom".
"""
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter, zoom


def fractal_noise(h, w, rng, octaves=5, base=4, persistence=0.55):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        g = rng.random((n + 1, n + 1)).astype(np.float32)
        up = zoom(g, (h / (n + 1), w / (n + 1)), order=3)[:h, :w]
        out += amp * up
        tot += amp
        amp *= persistence
    out /= tot
    return (out - out.min()) / (np.ptp(out) + 1e-6)


def warped_filaments(h, w, rng, strength=40):
    """Domain-warped noise -> swirling, current-driven filaments typical of blooms."""
    n = fractal_noise(h, w, rng, octaves=5, base=3)
    n = 1 - np.abs(2 * n - 1)          # ridged noise -> thin filaments
    wx = (fractal_noise(h, w, rng, base=2) - 0.5) * strength
    wy = (fractal_noise(h, w, rng, base=2) - 0.5) * strength
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return map_coordinates(n, [yy + wy, xx + wx], order=1, mode="reflect")


def make_scene(h=256, w=256, seed=None, bloom=True, land=None, clouds=None):
    rng = np.random.default_rng(seed)
    land = rng.random() < 0.4 if land is None else land
    clouds = rng.random() < 0.35 if clouds is None else clouds

    # --- open-ocean water (deep blue, low NIR) ---
    waves = fractal_noise(h, w, rng, octaves=6, base=16, persistence=0.6)
    depth = fractal_noise(h, w, rng, octaves=3, base=2)
    B2 = 0.060 + 0.020 * depth + 0.008 * waves
    B3 = 0.040 + 0.012 * depth + 0.006 * waves
    B4 = 0.018 + 0.006 * depth + 0.004 * waves
    B8 = 0.006 + 0.004 * waves

    # sun glint (hard negative): broad bright gradient in all bands
    if rng.random() < 0.5:
        gx = np.linspace(0, 1, w)[None, :] * rng.uniform(0.0, 0.05)
        B2 += gx; B3 += gx; B4 += gx; B8 += gx * 0.6

    # turbid coastal plume (hard negative): bright in red/green, not in NIR like scum
    if rng.random() < 0.5:
        turb = np.clip(fractal_noise(h, w, rng, base=2) * 2 - 1.1, 0, 1)
        B2 += 0.02 * turb; B3 += 0.05 * turb; B4 += 0.06 * turb; B8 += 0.008 * turb

    mask = np.zeros((h, w), np.float32)
    if bloom:
        fil = warped_filaments(h, w, rng, strength=rng.uniform(25, 60))
        envelope = fractal_noise(h, w, rng, octaves=2, base=1)
        intensity = np.clip((fil ** 1.5 * (0.35 + envelope) - rng.uniform(0.45, 0.6)) * 4, 0, 1)
        intensity = gaussian_filter(intensity, 0.8)
        mask = (intensity > 0.25).astype(np.float32)
        # red-tide signature: blue absorbed, green/red reflectance up, NIR up (surface accumulation)
        B2 = B2 * (1 - 0.35 * intensity)
        B3 = B3 + 0.055 * intensity
        B4 = B4 + 0.045 * intensity
        B8 = B8 + 0.050 * intensity

    if land:
        # desert coastline along a random edge (Dakhla-like sand, very bright NIR)
        coast = fractal_noise(h, w, rng, octaves=4, base=3)
        ramp = np.linspace(0, 1, w)[None, :].repeat(h, 0)
        if rng.random() < 0.5:
            ramp = ramp[:, ::-1]
        landm = (ramp + 0.25 * coast) > rng.uniform(0.82, 0.95)
        sand = fractal_noise(h, w, rng, octaves=5, base=8)
        for b, v in ((0, 0.20), (1, 0.27), (2, 0.36), (3, 0.42)):
            arr = (B2, B3, B4, B8)[b]
            arr[landm] = (v + 0.05 * sand)[landm]
        mask[landm] = 0

    if clouds:
        c = np.clip(fractal_noise(h, w, rng, octaves=6, base=3) * 2.2 - rng.uniform(1.25, 1.6), 0, 1)
        c = gaussian_filter(c, 2)
        for arr in (B2, B3, B4, B8):
            arr[...] = arr * (1 - c) + 0.55 * c
        mask[c > 0.5] = 0  # bloom invisible under thick cloud

    img = np.stack([B2, B3, B4, B8]).astype(np.float32)
    img += rng.normal(0, 0.0025, img.shape).astype(np.float32)  # sensor noise
    return np.clip(img, 0, 1), mask


def true_color(img, gain=3.2, gamma=0.8):
    """Sentinel-2-style true colour (B4, B3, B2) as uint8 RGB."""
    rgb = np.stack([img[2], img[1], img[0]], -1) * gain
    rgb = np.clip(rgb, 0, 1) ** gamma
    return (rgb * 255).astype(np.uint8)
