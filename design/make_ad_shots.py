# App Store 用の広告スクリーンショット（見出し＋スマホの画面。1179×2556）を作る:
#   uv run --with pillow python design/make_ad_shots.py
# 元の画面は design/store_shots/1〜6.png。出力は design/store_ad/1〜6.png。
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1179, 2556
G9 = '/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc'
G6 = '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
NAVY, NAVY2, YEL, WHITE = (17, 48, 78), (10, 28, 48), (247, 198, 46), (255, 255, 255)
# (元画像, 見出し, 補足, 地の色, 見出しの色, 補足の色)
SLIDES = [
    (1, 'パッと見て、\nテンポよく覚える', '0.1秒から選べるフラッシュ', YEL, NAVY, NAVY),
    (2, '1分で\n覚えたか確かめる', '正解で0.5秒延びる4択テスト', NAVY, WHITE, YEL),
    (3, '得点で\n伸びがわかる', '毎回の結果を記録', YEL, NAVY, NAVY),
    (4, '定着が\nひと目でわかる', 'パックの600語を1マスずつ色分け', NAVY, WHITE, YEL),
    (5, '忘れかけた語を\n自動で復習', '直近5回の成績から判定', YEL, NAVY, NAVY),
    (6, '13パック\n7,800語', '受験から金融・医療・AIまで', NAVY, WHITE, YEL),
]

def phone(src, width):
    s = width / src.width
    im = src.resize((width, round(src.height * s)), Image.LANCZOS).convert('RGBA')
    r = round(width * 0.11)
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
    pad = round(width * 0.028)
    body = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle([0, 0, body.width - 1, body.height - 1], r + pad, fill=(14, 18, 24, 255))
    body.paste(im, (pad, pad), mask)
    return body

def slide(n, head, sub, bg, hc, sc):
    im = Image.new('RGBA', (W, H), bg + (255,))
    d = ImageDraw.Draw(im)
    d.multiline_text((W / 2, 300), head, font=ImageFont.truetype(G9, 124), fill=hc, anchor='mm', align='center', spacing=26)
    d.text((W / 2, 520), sub, font=ImageFont.truetype(G6, 54), fill=sc, anchor='mm')
    ph = phone(Image.open(os.path.join(HERE, 'store_shots', f'{n}.png')), 930)
    x, y = (W - ph.width) // 2, 640
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 90), (x, y + 24, x + ph.width, y + 24 + ph.height), ph.split()[3])
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(36)))
    im.alpha_composite(ph, (x, y))
    return im.convert('RGB')

out = os.path.join(HERE, 'store_ad')
os.makedirs(out, exist_ok=True)
for i, s in enumerate(SLIDES, 1):
    slide(*s).save(os.path.join(out, f'{i}.png'))
ims = [Image.open(os.path.join(out, f'{i}.png')) for i in range(1, 7)]
t = Image.new('RGB', (6 * 300 + 70, 660), 'white')
for i, im in enumerate(ims):
    t.paste(im.resize((300, 650)), (10 + i * 310, 5))
t.save(os.path.join(out, 'sheet.png'))
print('ok')
