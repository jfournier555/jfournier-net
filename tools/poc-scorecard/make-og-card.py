#!/usr/bin/env python3
"""Per-tool OG card for the PoC Evaluation Scorecard.
Mirrors the site og-card.png layout (dark bg, subtle grid, steel-blue accent)
but headlines the tool name instead of Justin's name.
Output: tools/poc-scorecard/og-card.png (1200x630).
"""
from PIL import Image, ImageDraw, ImageFont

SRC = "/home/hatch/workspace/jfournier-site/og-card.png"
OUT = "/home/hatch/workspace/jfournier-site/tools/poc-scorecard/og-card.png"

W, H = 1200, 630
ACCENT = (0x5B, 0x9D, 0xFF)   # #5b9dff
WHITE = (0xF2, 0xF2, 0xF2)
GRAY = (0x9A, 0x9A, 0x9A)
MONO_GRAY = (0x8A, 0x8A, 0x8A)

# Sample the exact background and grid colors from the site card.
src = Image.open(SRC).convert("RGB")
bg = src.getpixel((10, 10))
print("bg:", "#%02x%02x%02x" % bg)
# Grid line: scan a row for a pixel slightly lighter than bg.
grid = bg
for x in range(0, W, 1):
    px = src.getpixel((x, 300))
    if px != bg and px[0] > bg[0]:
        grid = px
        break
print("grid sample:", "#%02x%02x%02x" % grid)

img = Image.new("RGB", (W, H), bg)
d = ImageDraw.Draw(img)

# Subtle grid, same spacing as the site card (60px).
for x in range(0, W, 60):
    d.line([(x, 0), (x, H)], fill=grid, width=1)
for y in range(0, H, 60):
    d.line([(0, y), (W, y)], fill=grid, width=1)

SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"

X = 70
# Steel-blue rule, same as the site card.
d.rectangle([X, 130, X + 60, 135], fill=ACCENT)

# Headline, two lines.
f_head = ImageFont.truetype(SANS_BOLD, 96)
d.text((X, 175), "PoC Evaluation", font=f_head, fill=WHITE)
d.text((X, 275), "Scorecard", font=f_head, fill=WHITE)

# Subtitle.
f_sub = ImageFont.truetype(SANS, 42)
d.text((X, 405), "Score an evaluation before you run it.", font=f_sub, fill=GRAY)

# Mono detail line.
f_mono = ImageFont.truetype(MONO, 28)
d.text((X, 465), "Eight criteria · Four red flags · One verdict", font=f_mono, fill=MONO_GRAY)

# Site mark, steel-blue mono, same as the site card.
f_mark = ImageFont.truetype(MONO, 32)
d.text((X, 525), "jfournier.net", font=f_mark, fill=ACCENT)

img.save(OUT)
print("saved", OUT)
