# 引き継ぎ資料：英単語フラッシュ

最終更新：2026-10-22
オーナー：Mafujio（株式会社iCurate 代表）
目的：英単語アプリを App Store で公開する（無料＋単語パックごとの買い切り解除を予定）

## 0. 経緯
- 2026-10-19 宅建10分模試アプリ（`takken-mock-app`）の中の「英単語モード」として作成
- 2026-10-22 本人指示「宅建アプリと英単語アプリは同居しない」により、このリポジトリ（`eitango-flash`）へ切り出し。`takken-mock-app` からは英単語モードを削除した
- 切り出しで変えたこと：`App.tsx` は英単語専用のラッパーに。共通スタイルは `src/styles.ts`（元は宅建 `App.tsx` の `makeStyles`）。入口の「‹ 試験を選ぶ」ボタンは不要になったので削除。保存キー `vocab-progress-v1` とレベルid はそのまま（記録の形式は同居時と互換）
- 未設定：EAS の projectId（`npx eas init` で作る）・App Store Connect のアプリ・課金アイテム（商品IDは 1. を参照）。`app.json` の bundleId は `jp.icurate.eitangoflash`（仮。変えるなら ASC 登録前に）

## 1. パックと課金（2026-10-22 実装）

| 項目 | 仕様 |
|---|---|
| パック | 13パック×300語＝3,900語。`scripts/vocab/build.py` の `PACKS` が一覧（ファイル・id・表示名・説明・参考・グループ・無料）。グループは TOEIC（500〜900）／受験英語（高校受験 最難関・大学受験 難関）／専門分野（金融・医療・半導体・AI・IT・コンサル）。※ 中学入試（開成・灘）は英語の出題がないので「高校受験」とした |
| 単語の出どころ | 各パックは 2026-10-22 に Claude が頻度・難度の判断で作成（市販単語帳の転記ではない）。公式の頻出語リストとは未照合。基礎語（TOEIC 500/600 のリスト）とは重ならないように除外して作成。パック間の重なりは許容（413語） |
| 無料・お試し | TOEIC 500 は無料。ほかは未購入でも最初の30語（1回）だけ試せる（`TRIAL_WORDS`、`canUse()`）。試したあとは購入カードだけ |
| 課金 | 非消耗型。パックごと `jp.icurate.eitangoflash.<id（- は _）>`（`Level.sku`）と全部入り `jp.icurate.eitangoflash.all`（`ALL_SKU`）。価格はストア取得、取れないときの表示は App.tsx の `PRICE_LABEL`（600円／全部入り 3,000円。実際の価格は ASC で決める）。購入記録は端末内 `unlock-v1:<id>`（`storage.ts`）。復元は「購入を復元」。`__DEV__` では「[dev] 解放を切替」で確認できる |
| App Store Connect | 未登録（1.5 の手順）。EAS projectId は設定済み |
| 定着テスト | ①パックごと：300語覚えるごと（従来どおり、6.6 参照）。②**総合定着テスト**（一覧の最上部）：使えるパック（購入済み＋出題したことのあるパック）全体から 要再習得→未回答→✖を含む習得中 の語を各パック均等に最大30語（`mixedFixItems`）、選択肢は語のパックの意味（`buildMixedTest`）、結果はパックごとの履歴と log（kind `fix`）に記録、パックの300語周期（lastFix）は進めない（`finishMixedFix`）。画面は `mixtest`／`mixresult` |
| Web版 | `web/vocab/` は全パックを無料で使える（課金なし）。配布するなら注意 |

### パックを増やすとき
1. `scripts/vocab/<id>.txt` を作る（`語|意味|品詞`、300語、品詞は 名/動/形/副/接/前/熟）
2. `scripts/vocab/build.py` の `PACKS` に1行足す → `npm run vocab`
3. `scripts/test-vocab.ts` のパック数（13）を直す → `npm test`
4. App Store Connect に商品ID `jp.icurate.eitangoflash.<id>` の非消耗型を登録

## 1.5 App Store 申請の準備（2026-10-24）

本人の判断（2026-10-24）：英単語アプリは**英単語フラッシュを本命**にする。似たアプリを2本出すと審査ガイドライン4.3で却下されやすいため、「英単語１分トライアル」（takken-mock-app の別アプリ、App ID 6824195226）は提出を見送る（「App Store販売準備」セッションに連絡済み）。
パック名の「TOEIC 500〜900」は商標を避けて「スコア500〜900目安」に変更（id・商品IDは toeic500〜900 のまま）。一覧の下・説明文に TOEIC®・英検® の注記。

| 項目 | 状態 |
|---|---|
| EAS | プロジェクト作成済み（@icurate2022/eitango-flash、projectId は app.json の extra.eas） |
| アイコン | `assets/icon.png` を新規作成（紺の地に単語カード「Aa」と「1:00」）。`design/make_icon.py` で再生成（splash・Android・favicon も） |
| 掲載情報 | `store.config.json`（名前・サブタイトル・説明・キーワード・審査メモ・年齢区分）。`npx eas-cli metadata:push` で送る（版のページの項目は App Store Connect で手入力になることが多い） |
| プライバシー・サポート | `site/eitango-flash/`（privacy・support・icon）。Xserver の `public_html/apps/eitango-flash/` に本人がアップロード → https://apps.icurate.jp/eitango-flash/privacy/ ・ /support/ 。`site/style.css` は既存の apps のものと同じ（上書き不要）。apps のトップ（index.html）に載せるなら takken-mock-app 側の site/index.html に1件足す |
| スクリーンショット | `design/store_shots/1〜6.png`（1179×2556、中型ディスプレイ枠）。見本の学習記録で撮影（`design/capture/`） |
| App Store Connect | **本人が作業**：アプリ新規登録（名前 英単語フラッシュ、バンドルID jp.icurate.eitangoflash、SKU 例 eitangoflash、日本語）→ 作ったアプリの Apple ID を `eas.json` の `submit.production.ios.ascAppId` に入れる |
| 課金アイテム | **本人が作業**：下の13件を「非消耗型」で登録（価格は本人が決める。アプリ内の仮表示は1パック600円・全部入り3,000円）。審査に出すときはアプリの版と一緒に選ぶ |

| 参照名（例） | 商品ID | 説明（例） |
|---|---|---|
| スコア600目安パック | `jp.icurate.eitangoflash.toeic600` | スコア600目安の300語 |
| スコア700目安パック | `jp.icurate.eitangoflash.toeic700` | スコア700目安の300語 |
| スコア800目安パック | `jp.icurate.eitangoflash.toeic800` | スコア800目安の300語 |
| スコア900目安パック | `jp.icurate.eitangoflash.toeic900` | スコア900目安の300語 |
| 高校受験 最難関パック | `jp.icurate.eitangoflash.koko_nankan` | 高校受験 最難関の300語 |
| 大学受験 難関パック | `jp.icurate.eitangoflash.daigaku_nankan` | 大学受験 難関の300語 |
| 金融パック | `jp.icurate.eitangoflash.finance` | 金融の300語 |
| 医療パック | `jp.icurate.eitangoflash.medical` | 医療の300語 |
| 半導体パック | `jp.icurate.eitangoflash.semicon` | 半導体の300語 |
| AIパック | `jp.icurate.eitangoflash.ai` | AIの300語 |
| ITパック | `jp.icurate.eitangoflash.it` | ITの300語 |
| コンサルパック | `jp.icurate.eitangoflash.consulting` | コンサルの300語 |
| 全部入り | `jp.icurate.eitangoflash.all` | 全13パック・3,900語（今後追加のパックも） |

※「スコア500目安」は無料なので商品なし。

### 申請の手順
1. 上の App Store Connect の登録（本人）と、site のアップロード（本人）
2. `eas.json` に ascAppId を入れる
3. `npx eas-cli build -p ios --profile production --auto-submit`（ビルド番号は自動で増える。提出は本人が「提出してください」と言ってから）
4. TestFlight で実機確認：暗記・テストのテンポ、ハプティクス、Sandbox アカウントで購入・復元
5. `npx eas-cli metadata:push`、スクリーンショット6枚、課金アイテムを版に追加 → 審査へ提出（本人）

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
- [x] 単語パックごとの課金解除（非消耗型）を実装（2026-10-22）
- [ ] 各パックの語彙の妥当性チェック（別担当で、分野の頻出語リストと突き合わせ）
- [ ] App Store Connect にアプリと課金アイテム（13＋1件）を登録し、実機で購入・復元を確認

### 2026-10-24 デザイン刷新（本人要望「より使いやすく知的な感じに」。アプリ版・Web版とも）
- 英単語は辞書の見出し語のようにセリフ体（iOS は Georgia）、品詞は小さな枠、数字（時計・得点・件数）は等幅（iOS は Menlo）
- 暗記・テスト中は時計と時間の帯を画面上部に固定し、その下だけをスクロール（`Timed`）。そのため App.tsx は ScrollView を持たず、スクロールは `VocabApp` 側
- パックのホームに「語彙マップ」（300語を1マスずつ、出題順・状態の色）、一覧に状態の内訳の帯
- テストで不正解のとき「✖ 語 ＝ 正しい意味」を次の問題の上に表示。Web版は 1〜4 キーでも回答
- Web版：出題順 `ord` を初回の開始時に保存（途中でやめても順が変わらない）、`cursor` は進めない（アプリ版と同じ）。一覧はパックの group ごとに見出し
- 確認：`npm test`・`npm run typecheck`、Web表示（スマホ幅）で一覧・お試しパック・暗記（時計固定）・テストを目視。実機は未確認

## 3. コマンド
```bash
npm install
npx expo start
npm test              # scripts/test-vocab.ts（データ検査・出題・得点）
npm run typecheck
npm run vocab         # scripts/vocab/*.txt → src/data/vocab.json → web/vocab/vocab.html
```
