#!/usr/bin/env python3
"""Kept in the repo so the cards can be regenerated. Icon-led card variants for the aspect ratios the wide card cannot survive.

og-card-2.png is 1200x630 and reads perfectly at 1.91:1 (Facebook, LinkedIn,
iMessage, X large card). Anywhere it gets centre-cropped square — Google mobile
search thumbnails most of all — it is destroyed: the headline loses its first
word, the icon is sliced in half, and the strapline reads "ore & Google Play".

So these are composed for their own ratio rather than cropped from the wide one.
They lead with the App Store icon because it is the one element that stays
legible when a thumbnail is 100px wide, and Google's structured-data guidance
asks for 16:9, 4:3 and 1:1 variants in the schema.org image array.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

ICON = "/Users/tim/Developer/cadet-ai/ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png"
OUTDIR = "/Users/tim/Developer/cadet-ai-website/assets"
FONT = "/System/Library/Fonts/Avenir Next Condensed.ttc"
GOLD = (212, 175, 55)

# Same palette as the wide card so the set looks like one family.
TL, TR = np.array([27, 33, 22.]), np.array([20, 25, 17.])
BL, BR = np.array([21, 26, 18.]), np.array([15, 18, 13.])


def background(W, H, glow_xy, glow_r):
    xs = np.linspace(0, 1, W)[None, :, None]
    ys = np.linspace(0, 1, H)[:, None, None]
    bg = TL * (1 - xs) * (1 - ys) + TR * xs * (1 - ys) + BL * (1 - xs) * ys + BR * xs * ys
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - glow_xy[0]) ** 2 + (yy - glow_xy[1]) ** 2)
    bg += (np.clip(1 - d / glow_r, 0, 1) ** 2)[..., None] * np.array([16, 20, 10.])
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    ImageDraw.Draw(img).rectangle([0, 0, W, max(6, H // 100)], fill=GOLD)
    return img


def rounded_icon(size):
    icon = Image.open(ICON).convert("RGB").resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1],
                                        radius=int(size * 4 * 0.225), fill=255)
    mask = m.resize((size, size), Image.LANCZOS)
    ring = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(ring).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1],
                                           radius=int(size * 4 * 0.225),
                                           outline=255, width=int(size * 4 * 0.012))
    return icon, mask, ring.resize((size, size), Image.LANCZOS)


def centred(draw, y, text, font, fill, W):
    w = draw.textbbox((0, 0), text, font=font)[2]
    draw.text(((W - w) // 2, y), text, font=font, fill=fill)


def build(W, H, icon_px, name):
    card = background(W, H, (W // 2, int(H * 0.40)), W * 0.55)
    icon, mask, ring = rounded_icon(icon_px)

    ix, iy = (W - icon_px) // 2, int(H * 0.40) - icon_px // 2
    shadow = Image.new("L", (icon_px + 80, icon_px + 80), 0)
    shadow.paste(mask, (40, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20)).point(lambda v: int(v * 0.55))
    card.paste(Image.new("RGB", (icon_px + 80, icon_px + 80), (6, 8, 5)),
               (ix - 40, iy - 30), shadow)
    card.paste(icon, (ix, iy), mask)
    card.paste(Image.new("RGB", (icon_px, icon_px), GOLD), (ix, iy),
               ring.point(lambda v: int(v * 0.85)))

    d = ImageDraw.Draw(card)
    s = W / 1200.0
    f_name = ImageFont.truetype(FONT, int(96 * s), index=0)
    f_sub  = ImageFont.truetype(FONT, int(44 * s), index=5)
    f_str  = ImageFont.truetype(FONT, int(38 * s), index=5)

    y = iy + icon_px + int(56 * s)
    # "CADET AI" with AI in gold, drawn as two runs so the colours split
    a, b = "CADET ", "AI"
    wa = d.textbbox((0, 0), a, font=f_name)[2]
    wb = d.textbbox((0, 0), b, font=f_name)[2]
    x0 = (W - (wa + wb)) // 2
    d.text((x0, y), a, font=f_name, fill=(242, 244, 239))
    d.text((x0 + wa, y), b, font=f_name, fill=GOLD)

    y += int(108 * s)
    centred(d, y, "AI study aid for ACF & CCF cadets", f_sub, (185, 192, 178), W)
    y += int(58 * s)
    centred(d, y, "Now on the App Store & Google Play", f_str, (174, 186, 160), W)

    path = f"{OUTDIR}/{name}"
    card.save(path)
    print("wrote", path, card.size)


build(1200, 1200, 560, "og-square.png")   # 1:1  — Google mobile, square crops
build(1200, 900,  430, "og-4x3.png")      # 4:3  — Google structured data
