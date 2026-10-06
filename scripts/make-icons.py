"""
Builds the app logo and icons. Run from the app folder after replacing either
source file. Needs Python 3 with Pillow:

    python -m pip install pillow
    python scripts/make-icons.py

- docs/brand/bni-dheeras-logo.png (transparent): the in-app logo and the browser-tab icons.
- docs/brand/bni-dheeras-app-icon.png (square, logo on white): the installed app's icon
  on the phone's home screen, used as given.
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
# Home screen / installed app: the chapter's square app icon as given (white, so iOS shows no black).
# The file names change with the artwork, so phones that installed the app fetch the new icon.
app = Image.open("docs/brand/bni-dheeras-app-icon.png").convert("RGB")
app.resize((180, 180), Image.LANCZOS).save("src/app/apple-icon.png", optimize=True)
app.resize((192, 192), Image.LANCZOS).save("public/icons/app-192.png", optimize=True)
app.resize((512, 512), Image.LANCZOS).save("public/icons/app-512.png", optimize=True)
# Maskable: Android crops to circles and other shapes, so shrink the artwork into the central safe zone.
maskable = Image.new("RGB", (512, 512), (255, 255, 255))
inner = app.resize((450, 450), Image.LANCZOS)
maskable.paste(inner, ((512 - 450) // 2, (512 - 450) // 2))
maskable.save("public/icons/app-maskable-512.png", optimize=True)
print("Icons written.")
