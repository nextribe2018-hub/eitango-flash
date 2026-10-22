# 英単語フラッシュ

30語を1分で覚えて、1分でテストする英単語アプリ（Expo / React Native）。

- レベル：TOEIC 500〜900 の100点刻み（英検・高校・大学は参考表示）、各300語
- 正解で+0.5秒、得点＝残り秒＋正解数。300語ごとに間違えた語だけの定着テスト
- 記録は端末内のみ（ログイン・外部送信なし）

```bash
npm install
npx expo start
npm test && npm run typecheck
```

詳細は `docs/HANDOFF.md`。
