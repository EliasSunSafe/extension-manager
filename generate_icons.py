"""Generate the extension's own toolbar/menu icons (16/48/128 px)."""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "icons")
os.makedirs(OUT, exist_ok=True)

TOP = (96, 156, 250)
BOTTOM = (43, 103, 220)


def rounded_bg(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / max(size - 1, 1)
        c = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (size, y)], fill=c)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.24), fill=255
    )
    img.paste(bg, (0, 0), mask)
    return img


def draw_glyph(img, size):
    d = ImageDraw.Draw(img)
    cx = size / 2
    # toggle-switch glyph: white pill track + blue knob on the right (on state)
    pad = size * 0.18
    track_h = size * 0.34
    track = [pad, cx - track_h / 2, size - pad, cx + track_h / 2]
    d.rounded_rectangle(track, radius=int(track_h / 2), fill=(255, 255, 255, 245))
    kr = track_h / 2 - max(1, size * 0.035)
    kx = size - pad - kr - max(1, size * 0.02)
    d.ellipse([kx - kr, cx - kr, kx + kr, cx + kr], fill=BOTTOM + (255,))
    return img


for size in (16, 48, 128):
    img = rounded_bg(size)
    img = draw_glyph(img, size)
    img.save(os.path.join(OUT, f"icon{size}.png"))
    print(f"wrote icons/icon{size}.png ({size}x{size})")
