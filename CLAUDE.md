# CLAUDE.md

英単語フラッシュ：30語を1分で覚えて1分でテストする英単語アプリ。Expo（SDK 57）＋ React Native ＋ TypeScript。
App Store で「無料＋単語パックごとの買い切り解除」で公開するのが目標。
2026-10-22 に宅建10分模試アプリ（`takken-mock-app`）から切り出した。**宅建アプリとは同居させない**（本人指示）。

**作業を始める前に `docs/HANDOFF.md` を読むこと。** 経緯・仕様・今後の構想・TODO がまとまっている。

## 応答のルール
- 日本語で回答する。提案は表か箇条書きで
- 結論の理由を示す。分からないことは分からないと言う
- 変更したら `npm test` と `npm run typecheck` を通してから報告する
- 仕様（出題の流れ・得点・判定・定着テスト）を変えるときは先に確認する
- 語がそのまま安定キー（レベル内で一意）。語の入れ替えは該当語の差し替えで、順番を変えない。学習記録が壊れる
- 保存キー `vocab-progress-v1`・`unlock-v1:` とパックid・商品IDは変えない（学習記録・購入記録のキー）

## コマンド
```bash
npm install
npx expo start
npm test              # scripts/test-vocab.ts
npm run typecheck
npm run vocab         # scripts/vocab/*.txt → src/data/vocab.json → web/vocab/vocab.html
```

## 構成
- `App.tsx` ラッパー（読み込み・保存・スクロール） ／ `src/VocabScreens.tsx` 画面 ／ `src/vocab.ts` ロジック ／ `src/storage.ts` 保存 ／ `src/styles.ts` 共通スタイル ／ `src/theme.ts` 色
- `src/data/vocab.json` 13パック×300語（スコア500〜900目安（id は toeic500〜900）／高校受験 最難関・大学受験 難関／金融・医療・半導体・AI・IT・コンサル）。元データ `scripts/vocab/<id>.txt`（`語|意味|品詞` 1行1語）、一覧は `scripts/vocab/build.py` の `PACKS`
- 課金：`src/purchase.ts`（expo-iap・非消耗型）、商品IDは `Level.sku` と `ALL_SKU`。スコア500目安は無料、ほかは最初の30語お試し。詳細は HANDOFF 1.・申請の準備は HANDOFF 1.5
- `web/vocab/` Claudeアーティファクト用のWeb版（template.html → build.py → vocab.html）
- パックを増やすときは `scripts/vocab/` に txt を足して `build.py` の `PACKS` に1行追加し、`scripts/test-vocab.ts` のパック数も更新する（HANDOFF「パックを増やすとき」）

## 注意
- 「TOEIC」はETSの登録商標。アプリ名には使わず、説明文で「TOEIC対策」程度に留める
- 市販単語帳の選定・配列をそのまま写さない（編集著作物）。頻度分析で独自に作る
- `npx expo install` が失敗する環境では `expo/bundledNativeModules.json` の版を `npm install` で指定する
