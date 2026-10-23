# アプリアイコン（1024×1024・透過なし）とスプラッシュ用・Android用・favicon を作る:
#   uv run --with pillow python design/make_icon.py
# 図柄：紺の地に、重ねた単語カード。手前のカードにセリフ体の見出し語「Aa」と、等幅の「1:00」（1分）。
from PIL import Image, ImageDraw, ImageFont
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')
S = 1024
NAVY_T, NAVY_B = (28, 77, 112), (16, 44, 68)     # 地の上下（Web版の --accent に近い紺）
CARD, CARD2, INK, ACC = (255, 255, 255), (141, 184, 220), (21, 33, 42), (28, 77, 112)
SERIF = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
MONO = '/System/Library/Fonts/Menlo.ttc'

def card(size, fill, radius):
    im = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=fill)
    return im

def icon(bg=True):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if bg:
        d = ImageDraw.Draw(im)
        for y in range(S):
            t = y / (S - 1)
            d.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(NAVY_T, NAVY_B)) + (255,))
    W, H = 600, 700
    back = card((W, H), CARD2 + (255,), 56).rotate(9, resample=Image.BICUBIC, expand=True)
    im.alpha_composite(back, ((S - back.width) // 2 + 46, (S - back.height) // 2 - 6))
    front = card((W, H), CARD + (255,), 56)
    fd = ImageDraw.Draw(front)
    f = ImageFont.truetype(SERIF, 300)
    fd.text((W / 2, 300), 'Aa', font=f, fill=INK, anchor='mm')
    fd.line([(90, 470), (W - 90, 470)], fill=(214, 222, 225), width=6)
    m = ImageFont.truetype(MONO, 120, index=1)   # Menlo Bold
    fd.text((W / 2, 580), '1:00', font=m, fill=ACC, anchor='mm')
    front = front.rotate(-4, resample=Image.BICUBIC, expand=True)
    im.alpha_composite(front, ((S - front.width) // 2 - 18, (S - front.height) // 2 + 10))
    return im

full = icon()
full.convert('RGB').save(os.path.join(ASSETS, 'icon.png'))
full.convert('RGB').resize((48, 48), Image.LANCZOS).save(os.path.join(ASSETS, 'favicon.png'))
fg = icon(bg=False)
fg.save(os.path.join(ASSETS, 'splash-icon.png'))
# Android：前景は透過（安全域に収めるため縮小）、背景は紺、モノクロは白抜き
a = Image.new('RGBA', (S, S), (0, 0, 0, 0)); a.alpha_composite(fg.resize((680, 680), Image.LANCZOS), (172, 172))
a.save(os.path.join(ASSETS, 'android-icon-foreground.png'))
Image.new('RGB', (S, S), NAVY_B).save(os.path.join(ASSETS, 'android-icon-background.png'))
mono = Image.new('RGBA', (S, S), (0, 0, 0, 0)); mask = a.split()[3]
mono.paste((255, 255, 255, 255), (0, 0), mask); mono.save(os.path.join(ASSETS, 'android-icon-monochrome.png'))
print('icons written')
