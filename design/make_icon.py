# アプリアイコン（2026-10-24 本人決定：案1a「英単語 FLASH」と稲妻）と、スプラッシュ・Android・favicon・サイト用を作る:
#   uv run --with pillow python design/make_icon.py
# 図柄は design/icon_flash.py の a()（紺の地に黄色い稲妻、白い「英単語」、斜体の「FLASH」）。
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0]]
cwd = os.getcwd(); os.chdir(os.path.join(HERE, 'icon_drafts', 'one'))   # icon_flash.py は案の画像も書き出すので、案のフォルダで動かす
import importlib.util
spec = importlib.util.spec_from_file_location('icon_flash', os.path.join(HERE, 'icon_flash.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
os.chdir(cwd)
A = os.path.join(HERE, '..', 'assets')
icon = m.a().convert('RGB')
icon.save(os.path.join(A, 'icon.png'))
icon.resize((48, 48), Image.LANCZOS).save(os.path.join(A, 'favicon.png'))
icon.resize((256, 256), Image.LANCZOS).save(os.path.join(HERE, '..', 'site', 'eitango-flash', 'icon.png'))
# スプラッシュは地の色（app.json の #102C44）に、アイコンの図柄をそのまま置く
icon.save(os.path.join(A, 'splash-icon.png'))
# Android：背景は紺、前景は図柄を安全域（中央66%）に縮めたもの、モノクロは白抜き
S = 1024
Image.new('RGB', (S, S), (16, 44, 68)).save(os.path.join(A, 'android-icon-background.png'))
fg = Image.new('RGBA', (S, S), (0, 0, 0, 0)); fg.paste(icon.resize((680, 680), Image.LANCZOS), (172, 172))
fg.save(os.path.join(A, 'android-icon-foreground.png'))
from PIL import ImageDraw
mono = Image.new('RGBA', (S, S), (0, 0, 0, 0))   # モノクロは稲妻だけを白で
ImageDraw.Draw(mono).polygon([(330 + x * 360, 200 + y * 624) for x, y in m.BOLT], fill=(255, 255, 255, 255))
mono.save(os.path.join(A, 'android-icon-monochrome.png'))
print('icons written')
