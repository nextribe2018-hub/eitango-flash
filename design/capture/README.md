# ストア用スクリーンショット（1179×2556・中型ディスプレイ枠）

1. `npx expo export --platform web --output-dir /tmp/efweb`
2. `npx tsx design/capture/seed.ts /tmp/seed.json`（見本の学習記録。実在の利用者の記録ではない）
3. `puppeteer-core` を入れたフォルダで `node design/capture/cap.mjs /tmp/efweb /tmp/seed.json src/data/vocab.json /tmp/raw`（Google Chrome を使用）
4. `design/store_shots/1〜6.png` に 暗記・テスト・結果・語彙マップ・単語ごとの成績・パック一覧 の順で置いた
