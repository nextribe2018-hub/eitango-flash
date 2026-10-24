#!/usr/bin/env python3
"""単語パックの組み立て: python3 scripts/vocab/build.py src/data/vocab.json
scripts/vocab/<file>.txt（語|意味|品詞 1行1語）を検査して vocab.json を書く。
パックを足すときは PACKS に1行足す（id は変えない。購入記録・学習記録のキーになる）。"""
import json, sys, os
D = os.path.dirname(__file__)
SKU = 'jp.icurate.eitangoflash.'   # 買い切り商品IDの接頭辞（App Store Connect に同じIDで登録する）
# (ファイル, id, 表示名, 説明, 参考レベル, グループ, 無料か)
PACKS = [
  ('jhs',            'toeic500',       'スコア500目安',  '基本語。日常の名詞・動詞・形容詞',                 '中学1〜2年／英検5〜4級',               'スコア目安', True),
  ('eiken',          'toeic600',       'スコア600目安',  '高校で習う頻出語',                                 '高校基礎／英検準2級〜2級／共通テスト', 'スコア目安', False),
  ('toeic',          'toeic700',       'スコア700目安',  'ビジネス・職場の頻出語',                           '英検2級／大学中堅（日東駒専）',        'スコア目安', False),
  ('march',          'toeic800',       'スコア800目安',  '難関大・新聞記事レベルの語',                       'MARCH／英検準1級',                     'スコア目安', False),
  ('sokei',          'toeic900',       'スコア900目安',  '難語。論説文・学術記事レベル',                     '早慶・難関国立／英検1級',              'スコア目安', False),
  ('koko-nankan',    'koko-nankan',    '高校受験 最難関', '最難関校の長文・語彙問題で頻出する、教科書より一段上の語', '開成・灘・筑駒・早慶附属',   '受験英語', False),
  ('daigaku-nankan', 'daigaku-nankan', '大学受験 難関',   '難関大の論説文に出る抽象語・学術的な動詞・句動詞',   '早慶・上智・東大・京大・一橋',         '受験英語', False),
  ('finance',        'finance',        '金融',            '銀行・証券・運用・保険・会計・M&Aの用語',            '金融業界の実務',                       '専門分野', False),
  ('medical',        'medical',        '医療',            '症状・疾患・診断・治療・薬剤・検査の用語',          '医療・看護・製薬の実務',               '専門分野', False),
  ('semicon',        'semicon',        '半導体',          '設計・製造プロセス・装置・材料・検査の用語',        '半導体業界の実務',                     '専門分野', False),
  ('ai',             'ai',             'AI',              '機械学習・生成AI・データサイエンスの用語',          'AI の論文・技術記事',                  '専門分野', False),
  ('it',             'it',             'IT',              '開発・インフラ・クラウド・セキュリティの用語',      'IT の実務・ドキュメント',              '専門分野', False),
  ('consulting',     'consulting',     'コンサル',        '戦略・分析・提案・会議で使う用語とフレームワーク',  '経営コンサル・事業企画',               '専門分野', False),
]
PACK_WORDS = 600   # 1パックの語数（2026-10-24 本人指定で300→600。語は末尾に足し、順番は変えない）
POS = {'名', '動', '形', '副', '接', '前', '熟'}
out = []
ok = True
allw = {}
for key, lid, name, desc, ref, group, free in PACKS:
    words = []
    seen = set()
    for ln in open(os.path.join(D, key + '.txt'), encoding='utf-8'):
        ln = ln.strip()
        if not ln: continue
        parts = ln.split('|')
        if len(parts) != 3 or not all(parts):
            print(f'[{key}] FORMAT: {ln}'); ok = False; continue
        w, m, pos = parts
        if pos not in POS:
            print(f'[{key}] POS: {ln}'); ok = False
        if w.lower() in seen:
            print(f'[{key}] DUP: {w}'); ok = False
        seen.add(w.lower())
        allw.setdefault(w.lower(), []).append(key)
        words.append({'w': w, 'm': m, 'p': pos})
    print(f'{key}: {len(words)}')
    if len(words) != PACK_WORDS: ok = False
    out.append({'id': lid, 'name': name, 'desc': desc, 'ref': ref, 'group': group, 'free': free, 'sku': '' if free else SKU + lid.replace('-', '_'), 'words': words})
cross = {w: ks for w, ks in allw.items() if len(ks) > 1}
print(f'パック間で重なる語: {len(cross)}（別パック同士の重なりは許容）')
if not ok:
    sys.exit('fix the data')
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('written', sys.argv[1], f'{len(out)}パック・{sum(len(p["words"]) for p in out)}語')
