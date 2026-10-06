"""
Builds the app logo and icons from the chapter logo (docs/brand/bni-dheeras-logo.png).
Run from the app folder after replacing that file. Needs Python 3 with Pillow:

    python -m pip install pillow
    python scripts/make-icons.py
"""

from PIL import Image

src = Image.open("docs/brand/bni-dheeras-logo.png").convert("RGBA")
# Clear the near-invisible haze (alpha <= 8) that upscaled logos carry; real edges are far stronger.
r, g, b, a = src.split()
src = Image.merge("RGBA", (r, g, b, a.point(lambda v: 0 if v <= 8 else v)))


def trim(im, pad):
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def fit(im, max_w, max_h):
    k = min(max_w / im.width, max_h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def square(im, size, frac, bg):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = fit(im, size * frac, size * frac)
    canvas.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return canvas


logo = trim(src, 4)  # BNI® over DHEERAS
mark = trim(src.crop((0, 0, 812, 350)), 2)  # just "BNI" (no ®): readable at favicon sizes
WHITE, CLEAR = (255, 255, 255, 255), (0, 0, 0, 0)

# Shown in the app (header, login, kiosk) by src/components/brand-logo.tsx.
fit(logo, 640, 640).quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
    "src/assets/bni-dheeras-logo.png", optimize=True
)
# Browser tab.
square(mark, 256, 1.0, CLEAR).save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
square(mark, 192, 0.94, CLEAR).save("src/app/icon.png", optimize=True)
# Home screen / installed app: full logo on white (iOS turns transparency black).
square(logo, 180, 0.80, WHITE).convert("RGB").save("src/app/apple-icon.png", optimize=True)
square(logo, 192, 0.82, WHITE).convert("RGB").save("public/icons/icon-192.png", optimize=True)
square(logo, 512, 0.82, WHITE).convert("RGB").save("public/icons/icon-512.png", optimize=True)
# Maskable: Android crops to circles and other shapes, so keep the logo in the central safe zone.
square(logo, 512, 0.62, WHITE).convert("RGB").save("public/icons/maskable-512.png", optimize=True)
print("Icons written.")
