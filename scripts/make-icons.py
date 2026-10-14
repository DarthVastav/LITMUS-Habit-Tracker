#!/usr/bin/env python3
"""Generate the PWA icons: the score ring, which is the app's signature.

Run from the project root:  python3 scripts/make-icons.py
Outputs public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

BG = (13, 17, 23)
TRACK = (255, 255, 255, 30)
# Ends of the ring gradient — the "steady blue" band of the score scale.
ACC_A = (122, 168, 255)
ACC_B = (79, 110, 247)
SS = 4  # supersample factor


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build(size, rounded=True):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background plate
    radius = int(S * 0.22) if rounded else S // 2
    draw.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=BG + (255,))

    # Ring geometry
    pad = S * 0.24
    box = [pad, pad, S - pad, S - pad]
    width = int(S * 0.085)

    # Track
    draw.arc(box, 0, 360, fill=TRACK, width=width)

    # Progress arc, drawn in short segments so it can carry a gradient.
    start, sweep = -90, 268
    steps = 180
    for i in range(steps):
        a0 = start + sweep * (i / steps)
        a1 = start + sweep * ((i + 1.6) / steps)
        draw.arc(box, a0, a1, fill=lerp(ACC_A, ACC_B, i / steps) + (255,), width=width)

    # Centre dot — the "one number" the whole app reduces to.
    dot = S * 0.055
    c = S / 2
    draw.ellipse([c - dot, c - dot, c + dot, c + dot], fill=ACC_A + (255,))

    return img.resize((size, size), Image.LANCZOS)


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "public")
    os.makedirs(out, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        build(size).save(os.path.join(out, name))
        print("wrote", name)


if __name__ == "__main__":
    main()
