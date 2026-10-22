# 引き継ぎ資料：英単語フラッシュ

最終更新：2026-10-22
オーナー：Mafujio（株式会社iCurate 代表）
目的：英単語アプリを App Store で公開する（無料＋単語パックごとの買い切り解除を予定）

## 0. 経緯
- 2026-10-19 宅建10分模試アプリ（`takken-mock-app`）の中の「英単語モード」として作成
- 2026-10-22 本人指示「宅建アプリと英単語アプリは同居しない」により、このリポジトリ（`eitango-flash`）へ切り出し。`takken-mock-app` からは英単語モードを削除した
- 切り出しで変えたこと：`App.tsx` は英単語専用のラッパーに。共通スタイルは `src/styles.ts`（元は宅建 `App.tsx` の `makeStyles`）。入口の「‹ 試験を選ぶ」ボタンは不要になったので削除。保存キー `vocab-progress-v1` とレベルid はそのまま（記録の形式は同居時と互換）
- 未設定：EAS の projectId（`npx eas init` で作る）・App Store Connect のアプリ・課金アイテム。`app.json` の bundleId は `jp.icurate.eitangoflash`（仮。変えるなら ASC 登録前に）

## 1. 今後の構想（2026-10-22 本人）
- TOEIC ベースのレベルに加えて、受験英語（高校受験 最難関校／大学受験 早慶レベル等）と専門分野（金融・医療・半導体・AI・IT・コンサル）の単語パックを作り、種類ごとにアプリ内課金で解放する
- ※ 中学入試（開成・灘）は英語の出題がないため、受験英語は高校受験・大学受験の区分で作る
- 課金は非消耗型をパック単位で（`expo-iap` は依存に入れてあるが未実装）

## 2. 仕様（2026-10-19 作成時。名称は本人指定）

| 項目 | 仕様 |
|---|---|
| 位置づけ | このアプリ唯一のモード。画面は `src/VocabScreens.tsx`、ロジックは `src/vocab.ts`、記録は `vocab-progress-v1`（`src/storage.ts` の `loadVocab`/`saveVocab`） |
| データ | `src/data/vocab.json`：**TOEIC 500／600／700／800／900 の5レベル**（id `toeic500`〜`toeic900`、100点刻み）×300語。1レベル＝`{id, name, desc, ref（参考レベル：英検・高校・大学）, words}`、1語＝`{w: 語, m: 意味, p: 品詞}`。語がそのまま安定キー（レベル内で一意）。語の追加は末尾に、順番は変えない（cursor が位置で進むため）。**元データと組み立て**：`scripts/vocab/<jhs|eiken|toeic|march|sokei>.txt`（`語|意味|品詞` 1行1語）→ `python3 scripts/vocab/build.py src/data/vocab.json`（重複・300語を検査）。参考レベルの対応：500＝中学1〜2年／英検5〜4級、600＝高校基礎／英検準2〜2級／共通テスト、700＝英検2級／日東駒専、800＝MARCH／英検準1級、900＝早慶・難関国立／英検1級（2026-10-19 本人要望「TOEIC500から100点刻み、英検・大学・高校は参考として記載」。旧id jhs/eiken/toeic/march/sokei の記録は `LEVEL_ALIAS` で新idへ移行） |
| 1回の流れ | 30語を1分で覚える（`MEMO_SEC=60`、途中で「テストへ進む」可）→ 1分テスト（語→意味の4択、他の選択肢は同レベルの別の語の意味）→ 結果 |
| テストの時計 | 開始時60秒。正解1問ごとに `BONUS_SEC=0.5` 秒延びる。30問答えるか0秒で終了 |
| 得点 | `scoreOf` ＝ 残り秒（切り捨て）＋ 正解数。時間切れは残り0。未解答は不正解扱い |
| 出題順 | `cursor` から30語ずつ順に。300語で一周したら `weakOrder()`（誤答率が高い語 → 最後に間違えた語 → 元の順）で並べ直して2周目 |
| 記録 | レベルごとに `{cursor, learned（延べ語数）, lastFix, hist{語: {n,c,last}}, log[{at,kind,score,correct,asked,size,left,wrong[]}]}`。「同じ30語をもう一度」は `repeat=true` で cursor・learned を進めない |
| 定着テスト | `learned` が300の倍数になった時点（`fixDue()`）で、過去に1回でも間違えた語から最大30語（`fixWords()`、誤答率順）を暗記なしで1分テスト。結果は `kind: 'fix'` で記録、cursor は進めない。済ませるまで次の30語は始められない。間違いが0語なら `skipFix()` で済ませる |
| 判定 | `judge()`：正答率95%以上かつ70点以上＝完璧／80%以上＝定着／60%以上＝もう一息／それ未満＝要復習 |
| Web版 | `web/vocab/template.html` → `python3 web/vocab/build.py` → `web/vocab/vocab.html`。公開中：https://claude.ai/artifact/QCu5mtepbvXK69S4AWoyVC （capabilities db・user。保存先 `data/users/<uid>/vocab`） |
| テスト | `scripts/test-vocab.ts`（`npm test` に含む）：データ検査・30語ずつ一周・定着テストの条件・4択の形・得点・repeat |
| 未決・注意 | テスト形式は4択（本人未指定、1分30語なら選択式が現実的と判断）。語の選定とTOEICスコア帯への割り当ては作成者の判断で、公式の語彙リスト・スコア換算とは照合していない（500帯は中学基本語を土台として収録）。レベルを増やす（TOEIC 400・950 など）ときは `scripts/vocab/` に txt を足して build.py の LEVELS に1行追加 |

### 2026-10-20 英単語フラッシュの変更（本人要望。Web版とアプリ版 `src/vocab.ts`・`VocabScreens.tsx` の両方。テストは `scripts/test-vocab.ts`）
- 不具合：暗記画面の「前回×」が直前のテストと一致しなかった（「一度でも間違えた」で表示し、時間切れの未回答も×に数えていた）
- 単語ごとに直近5回の成績 `hist[語].r`（'1'＝◯正解／'0'＝✖不正解／'2'＝△時間切れで未回答、古い→新しい、最大5文字）と最終出題時刻 `t` を記録。△は正誤の回数 n・c に入れない。r がない旧記録は `last` の1文字とみなす。ログに `na`（未回答の語）を追加し、`wrong` は答えて間違えた語だけに
- 判定 `statusOf()`：△を除いた並びで 直近3回連続◯＝定着（✖✖◯◯◯も定着）／最新が✖ または ✖が◯より多い＝要再習得（✖◯◯✖✖など）／△だけ＝未回答のみ／それ以外＝習得中
- 次の30語 `planRound()`：要再習得→未回答のみ の語を最大9語（REVIEW_MAX、3割）＋まだ出ていない語をレベルごとのランダム順 `ord`（初回に決めて保存・固定）で。全部出たら 習得中→定着（出題が古い順）。cursor は使わなくなった（記録は残す）。TOEIC の頻出順データは手元にないためランダム順にした
- 定着テストは 要再習得→未回答のみ→✖を含む習得中 から最大30語。`fixDue` は learned が300の倍数を越えたかで判定
- レベル画面に「単語ごとの成績（直近5回）」（状態で絞り込み）、暗記画面・結果画面に◯✖△の5マス

### 次にやるとよいこと（Claude Code への引き継ぎ 2026-10-19）
- [ ] 実機（Expo Go）で英単語モードの暗記画面・テストのテンポ・ハプティクスを確認
- [ ] 各スコア帯の語彙の妥当性チェック（別担当で、TOEIC頻出語リストと突き合わせ。入れ替えるときは末尾追加ではなく該当語の差し替えで、語数300・30の倍数を維持）
- [ ] 必要なら逆方向（意味→英語）やタイプ入力モード、音声読み上げ（expo-speech は導入済み）
- [ ] 単語パックごとの課金解除（非消耗型）を実装する

## 3. コマンド
```bash
npm install
npx expo start
npm test              # scripts/test-vocab.ts（データ検査・出題・得点）
npm run typecheck
npm run vocab         # scripts/vocab/*.txt → src/data/vocab.json → web/vocab/vocab.html
```
