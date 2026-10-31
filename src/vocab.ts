// 英単語モード：30語を1分で覚える → 1分でテスト（正解で+0.5秒）→ 得点＝残り秒＋正解数。
// 単語ごとに直近5回の成績（◯✖△）を残して「定着／習得中／要再習得」を判定し、要再習得の語を次の30語に復習として混ぜる。
// 300語覚えるごとに要再習得の語で30語1分の定着テスト。
// 画面（App.tsx の Vocab〜）と Web版（web/vocab/）から同じ仕様で使う。
import vocabRaw from './data/vocab.json';

export type Word = { w: string; m: string; p: string };           // 語・意味・品詞
// パック（レベル）。ref＝参考レベル、group＝一覧での見出し（スコア目安／受験英語／専門分野）、free＝無料パック、sku＝買い切りの商品ID（無料なら空）
export type Level = { id: string; name: string; desc: string; ref: string; group: string; free: boolean; sku: string; words: Word[] };
// スコア目安は 500〜900 の100点刻み（id は toeic500〜900 のまま。表示名に商標は使わない）。旧id（2026-10-19 以前の記録）→ 新id
export const LEVEL_ALIAS: Record<string, string> = { jhs: 'toeic500', eiken: 'toeic600', toeic: 'toeic700', march: 'toeic800', sokei: 'toeic900' };
export const LEVELS: Level[] = vocabRaw as Level[];
export const LEVEL: Record<string, Level> = Object.fromEntries(LEVELS.map(l => [l.id, l]));
export const GROUPS: string[] = [...new Set(LEVELS.map(l => l.group))];
export const ALL_SKU = 'jp.icurate.eitangoflash.all';   // 全パック一括の商品ID
export const TRIAL_WORDS = 30;                           // 未購入パックで試せる語数（最初の1回）
// パックが使えるか：無料／購入済み／全部入り購入済み。未購入でも最初の30語（1回）は試せる
export const canUse = (L: Level, unlocked: Record<string, boolean>, lp: LevelProgress): boolean =>
  L.free || !!unlocked[L.id] || !!unlocked[ALL_SKU] || lp.learned < TRIAL_WORDS;
export const isOwned = (L: Level, unlocked: Record<string, boolean>): boolean => L.free || !!unlocked[L.id] || !!unlocked[ALL_SKU];

export const ROUND_SIZE = 30;      // 1回に覚える語数
// 暗記の最初のフラッシュ：英単語を出して x 秒後に意味、さらに x 秒で次の語（x は 0.1〜1.0秒を0.1刻みで利用者が選ぶ。2026-10-24 本人指定）。
// フラッシュのあとの一覧は時間制限なし（「テストへ」で進む）。フラッシュはテスト前に何回でもやり直せる
export const FLASH_SPEEDS = Array.from({ length: 10 }, (_, i) => (i + 1) / 10);   // 0.1〜1.0秒（0.1刻み）
export const FLASH_DEFAULT = 0.3;
export const TEST_SEC = 60;        // テストの時間
export const BONUS_SEC = 0.5;      // 正解1問ごとに延びる秒
export const FIX_EVERY = 300;      // 定着テストの間隔（覚えた語数）
export const CHOICES = 4;          // 意味の選択肢の数
export const HIST_N = 5;           // 単語ごとに残す直近の成績の回数
export const REVIEW_MAX = 9;       // 次の30語に混ぜる復習の上限（3割）

// 出題数・正解数・最後の正誤（いずれも答えた分だけ）、r＝直近5回 '1'◯正解／'0'✖不正解／'2'△時間切れで未回答（古い→新しい）、t＝最後に出した時刻
// okAt＝正解した時刻（定着チェックの起点）、stage＝済んだ定着チェック（1＝1週間、2＝1ヶ月）
export type WordHist = { n: number; c: number; last: 0 | 1; r?: string; t?: number; okAt?: number; stage?: number };
export type RoundLog = {
  at: number;                 // 実施時刻
  kind: 'round' | 'fix';      // 通常／定着テスト
  score: number;              // 得点＝残り秒（切り捨て）＋正解数
  correct: number;            // 正解数
  asked: number;              // 解答した数（時間切れなら30未満）
  size: number;               // 出題数
  left: number;               // 残り秒（小数1桁）
  wrong: string[];            // 答えて間違えた語（2026-10-20 以前の記録は未解答も含む）
  na?: string[];              // 時間切れで答えられなかった語
};
export type LevelProgress = {
  cursor: number;             // 旧方式の位置（2026-10-20 以降は出題に使わない。記録として残す）
  learned: number;            // これまでに覚えた延べ語数（30ずつ増える。定着テストの判定に使う）
  lastFix: number;            // 定着テストを実施した時点の learned
  ord?: number[];             // レベルごとのランダムな出題順（語の番号。初回に決めて固定）
  chk?: { w: [number, number]; m: [number, number] };   // 定着チェックの集計 [解答数, 正解数]（w＝1週間後、m＝1ヶ月後）
  hist: Record<string, WordHist>;
  log: RoundLog[];
};
export type VocabProgress = { v: 1; levels: Record<string, LevelProgress> };

export const emptyLevel = (): LevelProgress => ({ cursor: 0, learned: 0, lastFix: 0, hist: {}, log: [] });
export const emptyVocab = (): VocabProgress => ({ v: 1, levels: {} });
export const levelOf = (p: VocabProgress, id: string): LevelProgress => p.levels[id] ?? emptyLevel();

// 乱数（再現できるように seed つき。seed 省略で Math.random）
export function rng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function shuffle<T>(a: T[], r: () => number = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// 単語の状態：△を除いた並びで 直近3回連続◯＝定着（✖✖◯◯◯ も定着）／最新が✖ または ✖が◯より多い＝要再習得（✖◯◯✖✖ など）
//              △だけ＝未回答のみ／それ以外＝習得中／出題なし＝未出題
export type WordStatus = 'redo' | 'na' | 'mid' | 'fixed' | 'new';
export const STATUS_LABEL: Record<WordStatus, string> = { redo: '要再習得', na: '未回答のみ', mid: '習得中', fixed: '定着', new: '未出題' };
const RANK: Record<WordStatus, number> = { redo: 0, na: 1, mid: 2, fixed: 3, new: 4 };
// 直近の成績。r がない旧記録は最後の結果1回分とみなす
export const recentOf = (h?: WordHist): string => !h ? '' : typeof h.r === 'string' ? h.r : h.n ? (h.last ? '1' : '0') : '';
export function statusOf(h?: WordHist): WordStatus {
  const r = recentOf(h);
  if (!r) return 'new';
  const s = r.replace(/2/g, '');
  if (!s) return 'na';
  const x = (s.match(/0/g) || []).length;
  if (s.length >= 3 && s.slice(-3) === '111') return 'fixed';
  if (s.endsWith('0') || x > s.length - x) return 'redo';
  return 'mid';
}
const badness = (h?: WordHist) => { const r = recentOf(h); return (r.match(/0/g) || []).length * 2 + (r.match(/2/g) || []).length + (r.endsWith('0') ? 3 : 0); };
export function counts(level: Level, lp: LevelProgress): Record<WordStatus, number> {
  const c: Record<WordStatus, number> = { redo: 0, na: 0, mid: 0, fixed: 0, new: 0 };
  level.words.forEach(w => { c[statusOf(lp.hist[w.w])]++; });
  return c;
}
// 単語一覧（状態の順 → 悪い順）。未出題は除く
export function wordRows(level: Level, lp: LevelProgress, only?: WordStatus): { w: Word; h: WordHist; s: WordStatus }[] {
  return level.words.map(w => ({ w, h: lp.hist[w.w], s: statusOf(lp.hist[w.w]) }))
    .filter(x => x.s !== 'new' && (!only || x.s === only))
    .sort((a, b) => RANK[a.s] - RANK[b.s] || badness(b.h) - badness(a.h)) as { w: Word; h: WordHist; s: WordStatus }[];
}

// 出題順（ord）がなければランダムに決めて持たせる。足りない語番号は末尾にランダムに足す。変更がなければ同じオブジェクトを返す
export function ensureOrd(level: Level, lp: LevelProgress, r: () => number = Math.random): LevelProgress {
  const n = level.words.length;
  const seen = new Set<number>();
  const o = (Array.isArray(lp.ord) ? lp.ord : []).filter(i => i >= 0 && i < n && !seen.has(i) && (seen.add(i), true));
  if (o.length === n && lp.ord && lp.ord.length === n) return lp;
  const add: number[] = [];
  for (let i = 0; i < n; i++) if (!seen.has(i)) add.push(i);
  return { ...lp, ord: [...o, ...shuffle(add, r)] };
}
// 次の30語：要再習得 → 未回答のみ の語を最大9語（悪い順）＋まだ出ていない語（ランダム順）。全部出たら 習得中 → 定着（出題が古い順）
export function planRound(level: Level, lp: LevelProgress): { words: Word[]; review: Set<string>; fresh: number } {
  const ord = ensureOrd(level, lp).ord!.map(i => level.words[i]);
  const st = (w: Word) => statusOf(lp.hist[w.w]);
  const review = ord.filter(w => st(w) === 'redo' || st(w) === 'na')
    .sort((a, b) => RANK[st(a)] - RANK[st(b)] || badness(lp.hist[b.w]) - badness(lp.hist[a.w])).slice(0, REVIEW_MAX);
  const taken = new Set(review.map(w => w.w));
  const fresh = ord.filter(w => !taken.has(w.w) && st(w) === 'new');
  const rest = ord.filter(w => !taken.has(w.w) && st(w) !== 'new')
    .sort((a, b) => RANK[st(a)] - RANK[st(b)] || (lp.hist[a.w].t ?? 0) - (lp.hist[b.w].t ?? 0));
  const words = [...review, ...fresh, ...rest].slice(0, ROUND_SIZE);
  const rv = new Set(words.filter(w => st(w) !== 'new').map(w => w.w));
  return { words, review: rv, fresh: words.length - rv.size };
}
// ord を持った lp を渡すこと（ensureOrd 済み）。持っていなければ呼ぶたびに順が変わる
export const nextWords = (level: Level, lp: LevelProgress): Word[] => planRound(level, lp).words;

export type Question = { w: Word; choices: string[]; a: number; lv?: string };   // a＝正解の choices 番号、lv＝横断テストでの語のパックid

// テスト問題：語 → 意味の4択。他の選択肢は同じレベルの別の語の意味（同じ意味文は避ける）
export function buildTest(words: Word[], level: Level, r: () => number = Math.random): Question[] {
  const pool = level.words;
  return shuffle(words, r).map(w => {
    const used = new Set([w.m]);
    const others: string[] = [];
    let guard = 0;
    while (others.length < CHOICES - 1 && guard++ < 500) {
      const o = pool[Math.floor(r() * pool.length)];
      if (!used.has(o.m)) { used.add(o.m); others.push(o.m); }
    }
    const choices = shuffle([w.m, ...others], r);
    return { w, choices, a: choices.indexOf(w.m) };
  });
}

// 全パック横断の定着テスト：使えるパックの 要再習得 → 未回答のみ → ✖を含む習得中 の語を集め、パックごとに均等に最大30語
export type MixItem = { w: Word; lv: string };
export function mixedFixItems(p: VocabProgress, levels: Level[]): MixItem[] {
  const per = levels.map(L => fixWords(L, levelOf(p, L.id)).map(w => ({ w, lv: L.id })));
  const out: MixItem[] = [];
  for (let i = 0; out.length < ROUND_SIZE; i++) {
    let any = false;
    for (const q of per) { if (i < q.length && out.length < ROUND_SIZE) { out.push(q[i]); any = true; } }
    if (!any) break;
  }
  return out;
}
// 横断テストの問題：選択肢は語の属するパックの意味から
export function buildMixedTest(items: MixItem[], r: () => number = Math.random): Question[] {
  return shuffle(items, r).map(it => {
    const q = buildTest([it.w], LEVEL[it.lv], r)[0];
    return { ...q, lv: it.lv };
  });
}
// 横断テストの記録：語の属するパックごとに履歴と log（kind 'fix'）を残す。各パックの定着テスト周期（lastFix）は進めない
export function finishMixedFix(p: VocabProgress, qs: Question[], res: Result[], left: number): { next: VocabProgress; logs: Record<string, RoundLog> } {
  const by: Record<string, Result[]> = {};
  res.forEach((x, i) => { const lv = qs[i].lv ?? ''; (by[lv] ??= []).push(x); });
  const levels = { ...p.levels };
  const logs: Record<string, RoundLog> = {};
  Object.entries(by).forEach(([lv, rs]) => {
    const lp = levelOf(p, lv);
    const next = applyResults(lp, rs);
    const log = makeLog('fix', rs, left);
    next.log = [...lp.log, log];
    levels[lv] = next;
    logs[lv] = log;
  });
  return { next: { ...p, levels }, logs };
}

// 得点：残り秒は切り捨て。時間切れ（left<=0）なら残り秒0
export const scoreOf = (left: number, correct: number): number => Math.max(0, Math.floor(left + 1e-9)) + correct;

export type Result = { w: Word; ok: boolean; answered: boolean };

// 1回（通常）を記録：履歴（直近5回）・learned・log を更新。定着テストが必要になったら fixDue が true。
// repeat＝同じ30語のやり直し（記録は残すが learned は進めない）
export function finishRound(lp: LevelProgress, _level: Level, res: Result[], left: number, repeat = false): { next: LevelProgress; log: RoundLog; fixDue: boolean } {
  const next = applyResults(lp, res);
  if (!repeat) {
    next.learned = lp.learned + res.length;
  }
  const log = makeLog('round', res, left);
  next.log = [...lp.log, log];
  return { next, log, fixDue: fixDue(next) };
}

// 定着テストの対象：要再習得 → 未回答のみ → ✖を含む習得中 の順（同じ状態なら悪い順）。最大30語
export function fixWords(level: Level, lp: LevelProgress): Word[] {
  return wordRows(level, lp).filter(x => x.s === 'redo' || x.s === 'na' || (x.s === 'mid' && recentOf(x.h).includes('0')))
    .slice(0, ROUND_SIZE).map(x => x.w);
}
// learned が300の倍数を越えたら（前回の定着テストより後で）
export const fixDue = (lp: LevelProgress): boolean => Math.floor(lp.learned / FIX_EVERY) > Math.floor(lp.lastFix / FIX_EVERY);

// 定着テストを記録（learned は進めない）。間違いがなく対象語が0のときは記録だけ残して済ませる
export function finishFix(lp: LevelProgress, res: Result[], left: number): { next: LevelProgress; log: RoundLog } {
  const next = applyResults(lp, res);
  next.lastFix = lp.learned;
  const log = makeLog('fix', res, left);
  next.log = [...lp.log, log];
  return { next, log };
}
export function skipFix(lp: LevelProgress): LevelProgress { return { ...lp, lastFix: lp.learned }; }

function applyResults(lp: LevelProgress, res: Result[]): LevelProgress {
  const hist = { ...lp.hist };
  const now = Date.now();
  res.forEach(x => {
    const h = hist[x.w.w] ?? { n: 0, c: 0, last: 0 as 0 | 1 };
    const r = (recentOf(h) + (x.answered ? (x.ok ? '1' : '0') : '2')).slice(-HIST_N);
    // 未回答は△として残し、正誤の回数には入れない
    const okAt = h.okAt ?? (h.n > 0 && h.last === 1 ? h.t : undefined);
    // 不正解なら定着チェックは数え直し（次に正解した時点から）
    hist[x.w.w] = x.answered
      ? { n: h.n + 1, c: h.c + (x.ok ? 1 : 0), last: x.ok ? 1 : 0, r, t: now, okAt: x.ok ? okAt ?? now : undefined, stage: x.ok ? h.stage : 0 }
      : { ...h, r, t: now };
  });
  return { ...lp, hist };
}
function makeLog(kind: RoundLog['kind'], res: Result[], left: number): RoundLog {
  const correct = res.filter(x => x.ok).length;
  const asked = res.filter(x => x.answered).length;
  const l = Math.max(0, Math.round(left * 10) / 10);
  return { at: Date.now(), kind, score: scoreOf(l, correct), correct, asked, size: res.length, left: l, wrong: res.filter(x => x.answered && !x.ok).map(x => x.w.w), na: res.filter(x => !x.answered).map(x => x.w.w) };
}

// 記録のまとめ（ホーム・結果画面用）
export type Stats = { cnt: Record<WordStatus, number>; rounds: number; best: number; avg: number; bestCorrect: number; total: number; totalCorrect: number; wrongCount: number; mastered: number; fixes: number; fixAvg: number };
export function stats(level: Level, lp: LevelProgress): Stats {
  const rs = lp.log.filter(l => l.kind === 'round');
  const fx = lp.log.filter(l => l.kind === 'fix');
  const avg = (a: RoundLog[]) => a.length ? Math.round(a.reduce((s, l) => s + l.score, 0) / a.length * 10) / 10 : 0;
  const hs = Object.values(lp.hist);
  return {
    rounds: rs.length, best: Math.max(0, ...rs.map(l => l.score)), avg: avg(rs), bestCorrect: Math.max(0, ...rs.map(l => l.correct)),
    total: rs.reduce((s, l) => s + l.size, 0), totalCorrect: rs.reduce((s, l) => s + l.correct, 0),
    cnt: counts(level, lp), wrongCount: fixWords(level, lp).length,
    mastered: hs.filter(h => h.n >= 2 && h.c === h.n).length, fixes: fx.length, fixAvg: avg(fx),
  };
}
// 定着チェック：一度正解した語を、覚え直しなしで1週間後・1ヶ月後に出して定着率を測る（2026-10-31 本人指定）
export const CHECK_WEEK = 7;
export const CHECK_MONTH = 30;
const DAY_MS = 86400000;
export type CheckKind = 'w' | 'm';
const okTime = (h?: WordHist): number | undefined => h?.okAt ?? (h && h.n > 0 && h.last === 1 ? h.t : undefined);
export function checkDue(h: WordHist | undefined, now = Date.now()): CheckKind | null {
  const ok = okTime(h);
  const stage = h?.stage ?? 0;
  if (!ok || stage >= 2) return null;
  const days = (now - ok) / DAY_MS;
  if (days >= CHECK_MONTH) return 'm';
  return days >= CHECK_WEEK && stage === 0 ? 'w' : null;
}
export function checkItems(p: VocabProgress, levels: Level[], now = Date.now()): MixItem[] {
  return levels.flatMap(L => { const lp = levelOf(p, L.id); return L.words.filter(w => checkDue(lp.hist[w.w], now)).map(w => ({ w, lv: L.id, at: okTime(lp.hist[w.w]) ?? 0 })); })
    .sort((a, b) => a.at - b.at).slice(0, ROUND_SIZE).map(({ w, lv }) => ({ w, lv }));
}
// 定着チェックの記録：答えた語だけ集計する。正解なら次の段階へ、不正解は通常どおり覚え直し（正解した時点から数え直し）
export function finishCheck(p: VocabProgress, qs: Question[], res: Result[], left: number, now = Date.now()): { next: VocabProgress; logs: Record<string, RoundLog> } {
  const kinds = res.map((x, i) => checkDue(levelOf(p, qs[i].lv ?? '').hist[x.w.w], now));
  const r = finishMixedFix(p, qs, res, left);
  const levels = { ...r.next.levels };
  res.forEach((x, i) => {
    const kind = kinds[i], lv = qs[i].lv ?? '';
    if (!kind || !x.answered) return;
    const lp = levels[lv];
    const chk = { w: [...(lp.chk?.w ?? [0, 0])] as [number, number], m: [...(lp.chk?.m ?? [0, 0])] as [number, number] };
    chk[kind][0]++;
    if (x.ok) chk[kind][1]++;
    const h = lp.hist[x.w.w];
    levels[lv] = { ...lp, chk, hist: x.ok ? { ...lp.hist, [x.w.w]: { ...h, stage: kind === 'm' ? 2 : 1 } } : lp.hist };
  });
  return { next: { ...r.next, levels }, logs: r.logs };
}
export function retention(p: VocabProgress): { w: [number, number]; m: [number, number] } {
  const out = { w: [0, 0] as [number, number], m: [0, 0] as [number, number] };
  Object.values(p.levels).forEach(l => { (['w', 'm'] as const).forEach(k => { out[k][0] += l.chk?.[k][0] ?? 0; out[k][1] += l.chk?.[k][1] ?? 0; }); });
  return out;
}

// テストごとの計測：1問に使った秒数と正答率。記録は log に残っているので、古いテストの分もさかのぼって出せる
export const secPerQ = (l: RoundLog): number => l.asked ? Math.max(0, TEST_SEC + l.correct * BONUS_SEC - l.left) / l.asked : 0;
export const rateOf = (l: RoundLog): number => l.asked ? l.correct / l.asked : 0;
export type Growth = { n: number; rates: number[]; secs: number[]; rateFrom: number; rateTo: number; secFrom: number; secTo: number } | null;
// 伸び：はじめの5回と直近の5回の平均を比べる（6回から表示）。グラフは直近20回
export function growth(p: VocabProgress): Growth {
  const rs = Object.values(p.levels).flatMap(l => l.log).filter(l => l.kind === 'round' && l.asked > 0).sort((a, b) => a.at - b.at);
  if (rs.length < 6) return null;
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const head = rs.slice(0, 5), tail = rs.slice(-5), last = rs.slice(-20);
  return { n: rs.length, rates: last.map(rateOf), secs: last.map(secPerQ), rateFrom: avg(head.map(rateOf)), rateTo: avg(tail.map(rateOf)), secFrom: avg(head.map(secPerQ)), secTo: avg(tail.map(secPerQ)) };
}

// 能力の評価（S〜C）。テスト結果の蓄積から全パックまとめて計算する。基準は仮の値で、利用者の分布が集まったら見直す
//  瞬発力＝直近10回の通常テストで、1問に使った平均秒数
//  短期記憶力＝直近10回の通常テストの正答率（覚えた直後にどれだけ答えられたか）
//  記憶定着力＝定着チェック（1週間後・1ヶ月後）の正答率。20問たまるまでは、2回目以降に出た語の正答率（時間切れは除く）
export type Grade = 'S' | 'A' | 'B' | 'C';
export type Ability = { key: 'speed' | 'short' | 'retain'; label: string; grade: Grade | null; value: string; hint: string };
export const ABILITY_MIN_ROUNDS = 3;     // これより少ない回数では「計測中」
export const ABILITY_MIN_REPEATS = 30;   // 記憶定着力に必要な、再出題の解答数
const gradeHigh = (v: number, s: number, a: number, b: number): Grade => v >= s ? 'S' : v >= a ? 'A' : v >= b ? 'B' : 'C';
const gradeLow = (v: number, s: number, a: number, b: number): Grade => v <= s ? 'S' : v <= a ? 'A' : v <= b ? 'B' : 'C';
export function abilities(p: VocabProgress): Ability[] {
  const lps = Object.values(p.levels);
  const rounds = lps.flatMap(l => l.log).filter(l => l.kind === 'round' && l.asked > 0).sort((a, b) => a.at - b.at).slice(-10);
  const enough = rounds.length >= ABILITY_MIN_ROUNDS;
  const asked = rounds.reduce((a, l) => a + l.asked, 0);
  const secs = rounds.reduce((a, l) => a + Math.max(0, TEST_SEC + l.correct * BONUS_SEC - l.left), 0);
  const correct = rounds.reduce((a, l) => a + l.correct, 0);
  const perQ = asked ? secs / asked : 0;
  const rate = asked ? correct / asked : 0;
  let again = 0, againOk = 0;
  lps.forEach(l => Object.values(l.hist).forEach(h => {
    const s = (typeof h.r === 'string' ? h.r : '').replace(/2/g, '').slice(1);   // 最初の1回を除いた再出題の分
    again += s.length;
    againOk += (s.match(/1/g) || []).length;
  }));
  const keep = again ? againOk / again : 0;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const rt = retention(p);
  const checked = rt.w[0] + rt.m[0], kept = checked ? (rt.w[1] + rt.m[1]) / checked : 0;
  const useCheck = checked >= 20;   // 定着チェックが20問たまったら、そちらで評価する
  return [
    { key: 'speed', label: '瞬発力', grade: enough ? gradeLow(perQ, 1.5, 2, 3) : null, value: enough ? `1問 ${perQ.toFixed(1)}秒` : '計測中', hint: '1問に使う時間の短さ' },
    { key: 'short', label: '短期記憶力', grade: enough ? gradeHigh(rate, 0.9, 0.75, 0.6) : null, value: enough ? `正答率 ${pct(rate)}` : '計測中', hint: '覚えた直後のテストの正答率' },
    { key: 'retain', label: '記憶定着力', grade: useCheck ? gradeHigh(kept, 0.9, 0.75, 0.6) : again >= ABILITY_MIN_REPEATS ? gradeHigh(keep, 0.9, 0.75, 0.6) : null, value: useCheck ? `定着チェックの正答率 ${pct(kept)}` : again >= ABILITY_MIN_REPEATS ? `再出題の正答率 ${pct(keep)}` : '計測中', hint: 'もう一度出たときの正答率' },
  ];
}
// 判定の一言（30問・1分。満点は 60＋30＝90 に近い値）
export function judge(score: number, correct: number, size: number): string {
  const r = size ? correct / size : 0;
  if (r >= 0.95 && score >= 70) return '完璧。次の30語へ';
  if (r >= 0.8) return '定着しています';
  if (r >= 0.6) return 'もう一息。間違えた語をもう一度';
  return '要復習。同じ30語をやり直すのがおすすめ';
}
