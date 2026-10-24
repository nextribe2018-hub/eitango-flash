// 英単語フラッシュの画面。ロジックは src/vocab.ts、記録は src/storage.ts（vocab-progress-v1）、課金は App.tsx の Shop。
// 流れ：パックを選ぶ → 30語をフラッシュ（英単語 → 0.1〜0.3秒後に意味）→ 一覧で時間制限なしに覚える（フラッシュは何回でも）→ 1分テスト（正解で+0.5秒）→ 結果（得点＝残り秒＋正解数）
//       → 単語ごとに直近5回の◯✖△と状態（定着／習得中／要再習得）。要再習得の語は次の30語に復習として入る
//       → 300語ごとに要再習得の語で定着テスト。一覧からは全パック横断の定着テスト（総合定着テスト）も
// パックは無料（スコア500目安）／買い切り。未購入でも最初の30語は試せる
// 見た目は Web版（web/vocab/）と同じ：英単語は辞書の見出し語のようにセリフ体、数字は等幅、計時中は時計を上に固定、
// パックの全語（600語）を1マスずつ示す「語彙マップ」。この画面は自分でスクロールを持つ（計時中は時計の下だけをスクロール）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Colors } from './theme';
import type { Styles } from './styles';
import {
  LEVELS, LEVEL, GROUPS, ALL_SKU, TRIAL_WORDS, Level, Word, Question, Result, LevelProgress, VocabProgress, RoundLog,
  FLASH_SPEEDS, FLASH_DEFAULT, TEST_SEC, BONUS_SEC, FIX_EVERY, REVIEW_MAX, HIST_N, emptyLevel, levelOf, ensureOrd, planRound, buildTest,
  finishRound, finishFix, fixDue, fixWords, skipFix, stats, judge, recentOf, statusOf, wordRows, STATUS_LABEL, WordHist, WordStatus,
  canUse, isOwned, mixedFixItems, buildMixedTest, finishMixedFix,
} from './vocab';
import { loadFlashSec, saveFlashSec } from './storage';

type VScreen =
  | { name: 'levels' }
  | { name: 'level'; id: string }
  | { name: 'memo'; id: string; words: Word[]; repeat?: boolean }
  | { name: 'test'; id: string; words: Word[]; kind: 'round' | 'fix'; repeat?: boolean }
  | { name: 'result'; id: string; words: Word[]; res: Result[]; log: RoundLog; fixDue: boolean }
  // 全パック横断の定着テスト（総合定着テスト）
  | { name: 'mixtest'; qs: Question[] }
  | { name: 'mixresult'; qs: Question[]; res: Result[]; logs: Record<string, RoundLog> };

// 課金（App.tsx が用意）：価格の表示・購入・復元・開発用の切り替え
export type Shop = { msg: string | null; price: (sku: string) => string; buy: (sku: string) => void; restore: () => void; devToggle?: (id: string) => void };
export type VCtx = { c: Colors; st: Styles; p: VocabProgress; update: (p: VocabProgress) => void; unlocked: Record<string, boolean>; shop: Shop };

// 英単語はセリフ体（辞書の見出し語）、数字は等幅
const F = {
  word: Platform.select({ ios: 'Georgia', default: 'serif' }),
  num: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};
const MAP_ORDER: WordStatus[] = ['fixed', 'mid', 'na', 'redo', 'new'];
const stColor = (c: Colors, s: WordStatus): [string, string] =>
  s === 'fixed' ? [c.ok, c.okSoft] : s === 'mid' ? [c.ai, c.aiSoft] : s === 'redo' ? [c.ng, c.ngSoft] : s === 'na' ? [c.warn, c.warnSoft] : [c.muted, c.line];

export function VocabApp({ ctx }: { ctx: VCtx }) {
  const { c, st } = ctx;
  const [s, setS] = useState<VScreen>({ name: 'levels' });
  const scroll = useRef<ScrollView>(null);
  const [flashSec, setFlashSecState] = useState(FLASH_DEFAULT);   // フラッシュの速さ（端末に保存）
  useEffect(() => { loadFlashSec(FLASH_SPEEDS, FLASH_DEFAULT).then(setFlashSecState); }, []);
  const setFlashSec = (v: number) => { setFlashSecState(v); saveFlashSec(v); };
  const speed = { value: flashSec, set: setFlashSec };
  const go = useCallback((n: VScreen) => { setS(n); scroll.current?.scrollTo({ y: 0, animated: false }); }, []);
  const lp = 'id' in s ? levelOf(ctx.p, s.id) : emptyLevel();
  const setLp = (id: string, next: LevelProgress) => ctx.update({ ...ctx.p, levels: { ...ctx.p.levels, [id]: next } });
  const start = (id: string) => {
    const cur = levelOf(ctx.p, id);
    const withOrd = ensureOrd(LEVEL[id], cur);   // 初回はランダムな出題順を決めて保存
    if (withOrd !== cur) setLp(id, withOrd);
    go({ name: 'memo', id, words: planRound(LEVEL[id], withOrd).words });
  };
  const startFix = (id: string) => {
    const ws = fixWords(LEVEL[id], levelOf(ctx.p, id));
    if (!ws.length) { setLp(id, skipFix(levelOf(ctx.p, id))); go({ name: 'level', id }); return; }
    go({ name: 'test', id, words: ws, kind: 'fix' });
  };
  const startMixed = () => {
    const usable = LEVELS.filter(L => isOwned(L, ctx.unlocked) || levelOf(ctx.p, L.id).learned > 0);
    const items = mixedFixItems(ctx.p, usable);
    if (!items.length) return;
    go({ name: 'mixtest', qs: buildMixedTest(items) });
  };

  let body: React.ReactNode;
  const timed = s.name === 'memo' || s.name === 'test' || s.name === 'mixtest';   // 計時中は時計を上に固定
  if (s.name === 'levels') body = <Levels ctx={ctx} go={go} startMixed={startMixed} />;
  else if (s.name === 'level') body = <LevelHome key={s.id} ctx={ctx} speed={speed} level={LEVEL[s.id]} lp={lp} go={go} start={() => start(s.id)} startFix={() => startFix(s.id)} reset={() => setLp(s.id, emptyLevel())} />;
  else if (s.name === 'mixtest') {
    body = (
      <Test key={'mix' + s.qs[0].w.w} ctx={ctx} level={LEVEL[s.qs[0].lv!]} qs={s.qs} words={[]} kind="mix"
        onDone={(res, left) => {
          const r = finishMixedFix(ctx.p, s.qs, res, left);
          ctx.update(r.next);
          go({ name: 'mixresult', qs: s.qs, res, logs: r.logs });
        }} />
    );
  } else if (s.name === 'mixresult') body = <MixResult ctx={ctx} s={s} home={() => go({ name: 'levels' })} again={startMixed} />;
  else if (s.name === 'memo') body = <Memo key={s.words[0].w} ctx={ctx} speed={speed} level={LEVEL[s.id]} lp={lp} words={s.words} repeat={!!s.repeat} onDone={() => go({ name: 'test', id: s.id, words: s.words, kind: 'round', repeat: s.repeat })} />;
  else if (s.name === 'test') {
    body = (
      <Test key={s.kind + s.words[0].w} ctx={ctx} level={LEVEL[s.id]} words={s.words} kind={s.kind}
        onDone={(res, left) => {
          if (s.kind === 'fix') {
            const r = finishFix(lp, res, left);
            setLp(s.id, r.next);
            go({ name: 'result', id: s.id, words: s.words, res, log: r.log, fixDue: false });
          } else {
            const r = finishRound(lp, LEVEL[s.id], res, left, !!s.repeat);
            setLp(s.id, r.next);
            go({ name: 'result', id: s.id, words: s.words, res, log: r.log, fixDue: r.fixDue });
          }
        }} />
    );
  } else {
    body = (
      <ResultView ctx={ctx} s={s} lp={lp}
        again={() => go({ name: 'memo', id: s.id, words: s.words, repeat: true })}
        next={() => start(s.id)} fix={() => startFix(s.id)} home={() => go({ name: 'level', id: s.id })} />
    );
  }
  if (timed) return <View style={{ flex: 1, backgroundColor: c.bg }}>{body}</View>;   // 時計の下だけをスクロール（Timed）
  return (
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={st.wrap}>
      {body}
    </ScrollView>
  );
}

/* ---------- 小道具 ---------- */
function Btn({ ctx, label, onPress, primary, disabled, big, ghost }: { ctx: VCtx; label: string; onPress: () => void; primary?: boolean; disabled?: boolean; big?: boolean; ghost?: boolean }) {
  const { st, c } = ctx;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [st.btn, { borderRadius: 10, backgroundColor: c.paper }, primary && st.btnPri, ghost && { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 2 }, disabled && st.btnDis, big && { minHeight: 54 }, pressed && st.pressed]}>
      <Text style={[st.btnText, primary && st.btnPriText, ghost && { color: c.ai }, big && { fontSize: 16 }]}>{label}</Text>
    </Pressable>
  );
}
function Label({ ctx, children }: { ctx: VCtx; children: React.ReactNode }) {
  return <Text style={{ fontFamily: F.num, fontSize: 11, letterSpacing: 1.2, color: ctx.c.muted }}>{children}</Text>;
}
function Pos({ ctx, p }: { ctx: VCtx; p: string }) {
  const { c } = ctx;
  return <Text style={{ fontSize: 11, color: c.muted, borderWidth: 1, borderColor: c.line, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' }}>{p}</Text>;
}
const fmt = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, '0')}`;
const fmt1 = (sec: number) => Math.max(0, sec).toFixed(1);
const dateLabel = (at: number) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

// 直近5回の成績（左が古い）。空きは「・」
function Marks({ ctx, h }: { ctx: VCtx; h?: WordHist }) {
  const { c } = ctx;
  const r = recentOf(h);
  const cells = [...Array(Math.max(0, HIST_N - r.length)).fill('e'), ...r.split('')];
  return (
    <Text accessibilityLabel={`直近${r.length}回の成績`} style={{ fontFamily: F.num, fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
      {cells.map((ch, i) => (
        <Text key={i} style={{ color: ch === '1' ? c.ok : ch === '0' ? c.ng : ch === '2' ? c.warn : c.line }}>{ch === '1' ? '◯' : ch === '0' ? '✖' : ch === '2' ? '△' : '・'}</Text>
      ))}
    </Text>
  );
}
function StatusTag({ ctx, s }: { ctx: VCtx; s: WordStatus }) {
  const [fg, bg] = stColor(ctx.c, s);
  return <Text style={{ fontSize: 11, fontWeight: '700', color: fg, backgroundColor: s === 'new' ? 'transparent' : bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, overflow: 'hidden' }}>{STATUS_LABEL[s]}</Text>;
}
// 辞書の見出し語ふうの1行：語（セリフ）＋右上、意味＋品詞（＋補足）＋右下
function Entry({ ctx, w, top, right, first, review, note }: { ctx: VCtx; w: Word; top?: React.ReactNode; right?: React.ReactNode; first?: boolean; review?: boolean; note?: string }) {
  const { c } = ctx;
  return (
    <View style={{ paddingVertical: 9, gap: 2, borderTopWidth: first ? 0 : 0.5, borderTopColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Text style={{ fontFamily: F.word, fontSize: 19, fontWeight: '600', color: c.ink, flexShrink: 1 }}>{w.w}</Text>
          {review && <Text style={{ fontSize: 11, fontWeight: '700', color: c.ai, borderWidth: 1, borderColor: c.ai, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' }}>復習</Text>}
        </View>
        {top}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 14, color: c.ink, flexShrink: 1 }}>{w.m}</Text>
          <Pos ctx={ctx} p={w.p} />
          {!!note && <Text style={{ fontSize: 12, color: c.muted }}>{note}</Text>}
        </View>
        {right}
      </View>
    </View>
  );
}
// 状態の内訳を1本の帯で（定着→習得中→未回答→要再習得、残りは未出題）
function Stack({ ctx, cnt, n }: { ctx: VCtx; cnt: Record<WordStatus, number>; n: number }) {
  const { c } = ctx;
  return (
    <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.line }}>
      {MAP_ORDER.filter(k => k !== 'new' && cnt[k]).map(k => <View key={k} style={{ width: `${cnt[k] / n * 100}%`, backgroundColor: stColor(c, k)[0] }} />)}
    </View>
  );
}
// 時計：文脈・残り時間・時間の帯・右側（ボタン）・下に追加（テストの進み具合）
function Clock({ ctx, label, text, left, total, right, extra, warn = true }: { ctx: VCtx; label: string; text: React.ReactNode; left: number; total: number; right?: React.ReactNode; extra?: React.ReactNode; warn?: boolean }) {
  const { c } = ctx;
  const low = warn && left <= 10;   // 残り10秒で赤に（フラッシュの進み具合では使わない）
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 0.5, borderBottomColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>{label}</Text>
          <Text style={{ fontFamily: F.num, fontSize: 30, fontWeight: '600', color: low ? c.ng : c.ink, fontVariant: ['tabular-nums'] }}>{text}</Text>
        </View>
        {right}
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
        <View style={{ height: 4, width: `${Math.max(0, Math.min(100, left / total * 100))}%`, backgroundColor: low ? c.ng : c.ai }} />
      </View>
      {extra}
    </View>
  );
}
// 計時中の画面：時計を上に置き、その下だけをスクロールする
function Timed({ ctx, clock, children }: { ctx: VCtx; clock: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {clock}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[ctx.st.wrap, { paddingTop: 12 }]}>{children}</ScrollView>
    </>
  );
}

// フラッシュの速さ：英単語を出してから意味を出すまで（意味から次の語までも同じ）
type Speed = { value: number; set: (v: number) => void };
function SpeedChips({ ctx, speed }: { ctx: VCtx; speed: Speed }) {   // −／＋で0.1秒ずつ（0.1〜1.0秒）
  const { c, st } = ctx;
  const i = Math.max(0, FLASH_SPEEDS.indexOf(speed.value));
  const step = (d: number) => speed.set(FLASH_SPEEDS[Math.min(FLASH_SPEEDS.length - 1, Math.max(0, i + d))]);
  const btn = (label: string, d: number, dis: boolean, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={dis} onPress={() => step(d)}
      style={({ pressed }) => [{ width: 44, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, alignItems: 'center', justifyContent: 'center', opacity: dis ? 0.35 : 1 }, pressed && st.pressed]}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="adjustable" accessibilityLabel="フラッシュの速さ" accessibilityValue={{ text: `${speed.value.toFixed(1)}秒` }}>
      <Text style={st.note}>フラッシュの速さ</Text>
      {btn('−', -1, i === 0, '速くする')}
      <Text style={{ fontFamily: F.num, fontSize: 17, fontWeight: '600', color: c.ink, minWidth: 54, textAlign: 'center' }}>{speed.value.toFixed(1)}秒</Text>
      {btn('＋', 1, i === FLASH_SPEEDS.length - 1, '遅くする')}
    </View>
  );
}

/* ---------- パック一覧 ---------- */
function Levels({ ctx, go, startMixed }: { ctx: VCtx; go: (s: VScreen) => void; startMixed: () => void }) {
  const { c, st, unlocked, shop } = ctx;
  const usable = LEVELS.filter(L => isOwned(L, unlocked) || levelOf(ctx.p, L.id).learned > 0);
  const mixN = mixedFixItems(ctx.p, usable).length;
  const allOwned = !!unlocked[ALL_SKU] || LEVELS.every(L => isOwned(L, unlocked));
  return (
    <>
      <View style={{ gap: 4 }}>
        <Label ctx={ctx}>VOCABULARY FLASH · 30 WORDS / 60 SEC</Label>
        <Text style={[st.h1, { fontFamily: undefined, fontSize: 24 }]}>英単語フラッシュ</Text>
        <Text style={st.note}>30語をフラッシュで見て、一覧で覚え、1分で答える。単語ごとの直近5回で定着を測ります。スコア500目安は無料、ほかのパックは最初の30語を試せます。</Text>
      </View>
      <View style={[st.card, mixN > 0 && st.cardNow, { borderRadius: 12 }]}>
        <View style={st.rowBetween}>
          <Label ctx={ctx}>総合定着テスト</Label>
          {mixN > 0 && <Text style={st.tag}>{mixN}語</Text>}
        </View>
        <Text style={st.note}>使えるパック全体から、要再習得・未回答・最近間違えた語を各パック均等に最大30語集めて、暗記なしの1分テスト。各パックの成績に記録されます（300語ごとの定着テストの周期は進みません）。</Text>
        <Btn ctx={ctx} primary label={mixN ? `総合定着テストを始める（${mixN}語）` : '対象の語がまだありません'} onPress={startMixed} disabled={!mixN} />
      </View>
      {GROUPS.map(g => (
        <View key={g} style={{ gap: 10 }}>
          <Label ctx={ctx}>{g}</Label>
          {LEVELS.filter(L => L.group === g).map(L => {
            const lp = levelOf(ctx.p, L.id);
            const s = stats(L, lp);
            const owned = isOwned(L, unlocked);
            const n = L.words.length;
            return (
              <Pressable key={L.id} accessibilityRole="button" onPress={() => go({ name: 'level', id: L.id })}
                style={({ pressed }) => [st.card, { borderRadius: 12, gap: 8 }, pressed && st.pressed]}>
                <View style={st.rowBetween}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, flexShrink: 1 }}>{L.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {fixDue(lp) && owned && <Text style={st.tag}>定着テスト</Text>}
                    {L.free ? <Text style={[st.tag, { color: c.ok, backgroundColor: c.okSoft }]}>無料</Text> : !owned && <Text style={st.tag}>{lp.learned < TRIAL_WORDS ? 'お試し30語' : shop.price(L.sku)}</Text>}
                    <Text style={{ color: c.ai, fontSize: 20 }}>›</Text>
                  </View>
                </View>
                <Text style={st.note}>{L.desc}。参考：{L.ref}</Text>
                <Stack ctx={ctx} cnt={s.cnt} n={n} />
                <Text style={st.note}>
                  <Text style={{ fontFamily: F.num, color: c.ink }}>{s.cnt.fixed}</Text> 定着 · <Text style={{ fontFamily: F.num, color: c.ink }}>{n - s.cnt.new}/{n}</Text> 出題済み
                  {s.cnt.redo ? <Text style={{ color: c.ng }}> · 要再習得 <Text style={{ fontFamily: F.num }}>{s.cnt.redo}</Text></Text> : null}
                  {s.rounds ? <> · 最高 <Text style={{ fontFamily: F.num, color: c.ink }}>{s.best}</Text>点</> : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {!allOwned && (
        <View style={[st.card, { borderRadius: 12 }]}>
          <Text style={st.h2}>すべてのパックを解放</Text>
          <Text style={st.note}>{LEVELS.length}パック・{LEVELS.reduce((a, L) => a + L.words.length, 0)}語をまとめて買い切り。今後追加されるパックも使えます。</Text>
          <View style={st.wrapRow}>
            <Btn ctx={ctx} primary label={`全部入り ${shop.price(ALL_SKU)}`} onPress={() => shop.buy(ALL_SKU)} />
            <Btn ctx={ctx} label="購入を復元" onPress={shop.restore} />
          </View>
          {shop.msg && <Text style={st.note}>{shop.msg}</Text>}
        </View>
      )}
      <Text style={st.note}>30語をフラッシュ表示（英単語を出して0.1〜1.0秒後に意味。速さは選べます）し、そのあと一覧で時間制限なしに覚えます。フラッシュはテスト前に何回でもできます。テストは意味の4択。正解するたびに0.5秒延び、得点＝残り秒（切り捨て）＋正解数。30語はパックごとのランダムな順で選び、要再習得・未回答の語を最大{REVIEW_MAX}語まで復習として混ぜます。直近3回連続◯で定着、最新が✖なら要再習得。300語ごとに定着テストがあります。</Text>
      <Text style={st.note}>「スコア目安」は TOEIC® Listening & Reading のスコアの目安です。TOEIC は ETS の登録商標です。このアプリは ETS の承認や推奨を受けたものではありません。英検® は公益財団法人 日本英語検定協会の登録商標です。参考レベルは目安で、公式の語彙表ではありません。</Text>
    </>
  );
}

/* ---------- 購入カード（未購入パックのホーム） ---------- */
function BuyCard({ ctx, level, lp }: { ctx: VCtx; level: Level; lp: LevelProgress }) {
  const { st, shop } = ctx;
  const trial = lp.learned < TRIAL_WORDS;
  return (
    <View style={[st.card, !trial && st.cardNow, { borderRadius: 12 }]}>
      <Text style={st.h2}>{trial ? '最初の30語は無料で試せます' : 'このパックの続きは買い切りで'}</Text>
      <Text style={st.note}>{level.name}の全{level.words.length}語・定着テスト・単語ごとの成績が使えます。一度買えば同じ Apple ID でずっと使えます。</Text>
      <View style={st.wrapRow}>
        <Btn ctx={ctx} primary label={`${level.name}を買う ${shop.price(level.sku)}`} onPress={() => shop.buy(level.sku)} />
        <Btn ctx={ctx} label={`全部入り ${shop.price(ALL_SKU)}`} onPress={() => shop.buy(ALL_SKU)} />
        <Btn ctx={ctx} label="購入を復元" onPress={shop.restore} />
        {shop.devToggle && <Btn ctx={ctx} label="[dev] 解放を切替" onPress={() => shop.devToggle!(level.id)} />}
      </View>
      {shop.msg && <Text style={st.note}>{shop.msg}</Text>}
    </View>
  );
}

/* ---------- パックのホーム ---------- */
function LevelHome({ ctx, speed, level, lp, go, start, startFix, reset }: {
  ctx: VCtx; speed: Speed; level: Level; lp: LevelProgress; go: (s: VScreen) => void; start: () => void; startFix: () => void; reset: () => void;
}) {
  const { c, st } = ctx;
  const [confirm, setConfirm] = useState(false);
  const s = stats(level, lp);
  const owned = isOwned(level, ctx.unlocked);
  const usable = canUse(level, ctx.unlocked, lp);
  const due = fixDue(lp) && owned;
  const plan = planRound(level, ensureOrd(level, lp));
  const nrev = plan.words.length - plan.fresh;
  const recent = lp.log.slice(-8).reverse();
  const rem = FIX_EVERY - (lp.learned % FIX_EVERY);
  const big = { fontFamily: F.num, fontSize: 22, fontWeight: '600' as const, color: c.ink };
  return (
    <>
      <View style={{ alignSelf: 'flex-start' }}><Btn ctx={ctx} ghost label="‹ パック一覧" onPress={() => go({ name: 'levels' })} /></View>
      <View style={{ gap: 2 }}>
        <Label ctx={ctx}>{level.group} · 参考：{level.ref}</Label>
        <Text style={{ fontSize: 24, fontWeight: '700', color: c.ink }}>{level.name}</Text>
        <Text style={st.note}>{level.desc}</Text>
      </View>
      {!owned && <BuyCard ctx={ctx} level={level} lp={lp} />}
      {due && (
        <View style={[st.card, st.cardNow, { borderRadius: 12 }]}>
          <Text style={st.h2}>定着テストの時間です</Text>
          <Text style={st.body}>{lp.learned}語を学びました。要再習得などの語（{s.wrongCount}語）から最大30語を、暗記なしで1分テストします。</Text>
          <Btn ctx={ctx} primary big label="定着テストを始める" onPress={startFix} />
        </View>
      )}
      <View style={[st.card, !due && usable && st.cardNow, { borderRadius: 12 }]}>
        <Label ctx={ctx}>次の30語</Label>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          {s.cnt.new > 0 && <View><Text style={big}>{plan.fresh}</Text><Text style={st.note}>新しい語</Text></View>}
          <View><Text style={big}>{nrev}</Text><Text style={st.note}>復習（要再習得・未回答）</Text></View>
        </View>
        <Btn ctx={ctx} primary big label={!owned && usable ? '30語をフラッシュで試す' : '30語をフラッシュで覚える'} onPress={start} disabled={due || !usable} />
        <SpeedChips ctx={ctx} speed={speed} />
        <Text style={st.note}>{due ? '先に定着テストを済ませてください。' : !usable ? 'お試しの30語は終わりました。続きは購入後に使えます。' : `フラッシュ（英単語 → ${speed.value.toFixed(1)}秒後に意味）→ 一覧で好きなだけ → 1分テスト。復習は最大${REVIEW_MAX}語まで混ざります。`}</Text>
      </View>
      <WordMap ctx={ctx} level={level} lp={lp} cnt={s.cnt} />
      <View style={[st.card, { borderRadius: 12 }]}>
        <Label ctx={ctx}>スコア</Label>
        <View style={st.kpis}>
          {([['最高点', s.best, ''], ['平均点', s.avg, ''], ['回数', s.rounds, ''], ['正解の累計', s.totalCorrect, `/${s.total}`], ['要再習得', s.cnt.redo, ''], ['定着テスト', s.fixes, s.fixes ? ` 平均${s.fixAvg}` : '']] as const).map(([k, v, unit]) => (
            <View key={k} style={st.kpi}>
              <Text style={st.meta}>{k}</Text>
              <Text style={[st.kpiVal, { fontFamily: F.num, fontWeight: '600' }]}>{v}{!!unit && <Text style={{ fontSize: 12, fontWeight: '500', color: c.muted, fontFamily: undefined }}>{unit}</Text>}</Text>
            </View>
          ))}
        </View>
        <Text style={st.note}>得点＝残り秒＋正解数（例：残り25秒・28問正解 → 53点）。次の定着テストまで あと{due ? 0 : rem}語。</Text>
        {recent.length > 0 && (
          <View>
            {recent.map((l, i) => (
              <View key={l.at + '-' + i} style={st.histRow}>
                <Text style={st.note}>{dateLabel(l.at)}　{l.kind === 'fix' ? '定着テスト' : '通常'}</Text>
                <Text style={{ fontFamily: F.num, fontSize: 13, color: c.ink }}>{l.score}点　{l.correct}/{l.size}　残{fmt1(l.left)}s</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <WordTable ctx={ctx} level={level} lp={lp} cnt={s.cnt} />
      <View style={{ gap: 8 }}>
        {!confirm ? <View style={{ alignSelf: 'flex-start' }}><Btn ctx={ctx} ghost label="このパックの記録を消す" onPress={() => setConfirm(true)} /></View> : (
          <View style={[st.confirm, { backgroundColor: c.ngSoft }]}>
            <Text style={st.body}>{level.name}の記録（{lp.log.length}回分）を消します。元に戻せません。</Text>
            <View style={st.wrapRow}>
              <Btn ctx={ctx} primary label="消す" onPress={() => { reset(); setConfirm(false); }} />
              <Btn ctx={ctx} label="やめる" onPress={() => setConfirm(false)} />
            </View>
          </View>
        )}
      </View>
    </>
  );
}

// 語彙マップ：パックの全語を1マスずつ（出題順）。色＝状態。300語までは20列、それより多いと30列
function WordMap({ ctx, level, lp, cnt }: { ctx: VCtx; level: Level; lp: LevelProgress; cnt: Record<WordStatus, number> }) {
  const { c, st } = ctx;
  const n = level.words.length;
  const ord = lp.ord && lp.ord.length === n ? lp.ord : level.words.map((_, i) => i);
  const [w, setW] = useState(0);
  const cols = n > 300 ? 30 : 20;
  const cell = w ? Math.floor((w - 2 * (cols - 1)) / cols) : 0;
  return (
    <View style={[st.card, { borderRadius: 12 }]}>
      <View style={st.rowBetween}>
        <Label ctx={ctx}>語彙マップ · {n}語</Label>
        <Text style={st.note}><Text style={{ fontFamily: F.num, color: c.ink }}>{Math.round(cnt.fixed / n * 100)}%</Text> 定着</Text>
      </View>
      <View onLayout={e => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={`定着${cnt.fixed}語・習得中${cnt.mid}語・要再習得${cnt.redo}語・未回答のみ${cnt.na}語・未出題${cnt.new}語`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {cell > 0 && ord.map(i => {
          const s = statusOf(lp.hist[level.words[i].w]);
          return <View key={i} style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: s === 'new' ? c.line : stColor(c, s)[0] }} />;
        })}
      </View>
      <View style={[st.wrapRow, { gap: 10 }]}>
        {MAP_ORDER.map(k => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: k === 'new' ? c.line : stColor(c, k)[0] }} />
            <Text style={st.note}>{STATUS_LABEL[k]} <Text style={{ fontFamily: F.num }}>{cnt[k]}</Text></Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// 単語ごとの成績（直近5回）。状態で絞り込み
function WordTable({ ctx, level, lp, cnt }: { ctx: VCtx; level: Level; lp: LevelProgress; cnt: Record<WordStatus, number> }) {
  const { c, st } = ctx;
  const keys: WordStatus[] = ['redo', 'na', 'mid', 'fixed'];
  const [f, setF] = useState<WordStatus | 'all' | null>(null);
  const cur = f && (f === 'all' || cnt[f]) ? f : (keys.find(k => cnt[k]) ?? 'all');
  const seen = level.words.length - cnt.new;
  const rows = seen ? wordRows(level, lp, cur === 'all' ? undefined : cur) : [];
  const chip = (k: WordStatus | 'all', label: string, n: number) => (
    <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: cur === k, disabled: !n }} disabled={!n} onPress={() => setF(k)}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: cur === k ? 2 : 1, borderColor: cur === k ? c.ink : c.line, backgroundColor: c.paper, minHeight: 34, opacity: n ? 1 : 0.4 }, pressed && st.pressed]}>
      {k !== 'all' && <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: stColor(c, k)[0] }} />}
      <Text style={{ fontSize: 13, fontWeight: '700', color: c.ink }}>{label} <Text style={{ fontFamily: F.num }}>{n}</Text></Text>
    </Pressable>
  );
  return (
    <View style={[st.card, { borderRadius: 12 }]}>
      <Label ctx={ctx}>単語ごとの成績 · 直近5回</Label>
      <Text style={st.note}>左が古く右が新しい。◯正解 ✖不正解 △時間切れ。直近3回連続◯で定着、最新が✖（または✖が◯より多い）と要再習得になり、次の30語に復習として入ります。</Text>
      {!seen ? <Text style={st.note}>まだ出題していません。最初の30語を覚えると、ここに単語ごとの成績が並びます。</Text> : (
        <>
          <View style={[st.wrapRow, { gap: 6 }]}>
            {keys.map(k => chip(k, STATUS_LABEL[k], cnt[k]))}
            {chip('all', 'すべて', seen)}
          </View>
          <View>
            {rows.map((x, i) => <Entry key={x.w.w} ctx={ctx} w={x.w} first={i === 0} top={<StatusTag ctx={ctx} s={x.s} />} right={<Marks ctx={ctx} h={x.h} />} />)}
          </View>
        </>
      )}
    </View>
  );
}

/* ---------- 暗記：①フラッシュ（英単語 → 少し後に意味）→ ②一覧（時間制限なし。フラッシュは何回でも） ---------- */
function Memo({ ctx, speed, level, lp, words, repeat, onDone }: { ctx: VCtx; speed: Speed; level: Level; lp: LevelProgress; words: Word[]; repeat: boolean; onDone: () => void }) {
  const { c, st } = ctx;
  const [phase, setPhase] = useState<'flash' | 'list'>('flash');
  const [runs, setRuns] = useState(1);          // フラッシュした回数（今回を含む）
  const [step, setStep] = useState(0);          // フラッシュの段階：偶数＝英単語だけ、奇数＝意味も表示（語の番号は step/2）
  const done = useRef(false);
  const finish = useCallback(() => { if (done.current) return; done.current = true; onDone(); }, [onDone]);
  const n = words.length;
  const sec = speed.value;
  useEffect(() => {
    if (phase !== 'flash') return;
    let s = 0;
    setStep(0);
    const id = setInterval(() => {
      s++;
      if (s >= 2 * n) { clearInterval(id); setPhase('list'); } else setStep(s);
    }, Math.round(sec * 1000));
    return () => clearInterval(id);
  }, [phase, runs, n, sec]);

  if (phase === 'flash') {
    const k = Math.floor(step / 2);
    const w = words[k];
    return (
      <Timed ctx={ctx} clock={<Clock ctx={ctx} warn={false} label={`${level.name}　フラッシュ ${runs}回目　${k + 1}/${n}`}
          text={<>{sec.toFixed(1)}<Text style={st.bigUnit}> 秒</Text></>} left={step + 1} total={2 * n}
          right={<Btn ctx={ctx} ghost label="一覧へ ›" onPress={() => setPhase('list')} />} />}>
        <View style={[st.card, { borderRadius: 16, minHeight: 380, alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
          <Pos ctx={ctx} p={w.p} />
          <Text style={{ fontFamily: F.word, fontSize: 46, fontWeight: '600', color: c.ink, textAlign: 'center' }} adjustsFontSizeToFit numberOfLines={1}>{w.w}</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.ai, textAlign: 'center', opacity: step % 2 ? 1 : 0 }}>{w.m}</Text>
        </View>
        <Text style={st.note}>英単語を出して{sec.toFixed(1)}秒後に意味、さらに{sec.toFixed(1)}秒で次の語へ。終わると一覧になります。</Text>
      </Timed>
    );
  }
  return (
    <Timed ctx={ctx} clock={
      <View style={{ backgroundColor: c.bg, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: c.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>{level.name}　一覧で覚える {n}語{repeat ? '（もう一度）' : ''}</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>時間制限なし</Text>
        </View>
        <Btn ctx={ctx} primary label="テストへ ›" onPress={finish} />
      </View>}>
      <View style={{ gap: 10 }}>
        <View style={{ alignSelf: 'flex-start' }}><Btn ctx={ctx} label={`もう一度フラッシュ（${runs + 1}回目）`} onPress={() => { setRuns(r => r + 1); setPhase('flash'); }} /></View>
        <SpeedChips ctx={ctx} speed={speed} />
      </View>
      <View style={[st.card, { borderRadius: 12, gap: 0, paddingVertical: 8 }]}>
        {words.map((w, i) => {
          const h = lp.hist[w.w];
          const seen = !!recentOf(h);
          return <Entry key={w.w} ctx={ctx} w={w} first={i === 0} review={seen} top={seen ? <Marks ctx={ctx} h={h} /> : undefined} />;
        })}
      </View>
      <Text style={st.note}>フラッシュはテストの前に何回でもできます（{runs}回済み）。テストは1分の4択です。「復習」は前に出た語で、右は直近の成績です。</Text>
    </Timed>
  );
}

/* ---------- テスト（1分、正解で+0.5秒） ---------- */
function Test({ ctx, level, words, kind, onDone, qs: given }: { ctx: VCtx; level: Level; words: Word[]; kind: 'round' | 'fix' | 'mix'; onDone: (res: Result[], left: number) => void; qs?: Question[] }) {
  const { c, st } = ctx;
  const [qs] = useState<Question[]>(() => given ?? buildTest(words, level));
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState(TEST_SEC);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);   // 直前の答えの結果（不正解なら正しい意味）
  const start = useRef(Date.now());
  const bonus = useRef(0);
  const res = useRef<Result[]>(qs.map(q => ({ w: q.w, ok: false, answered: false })));
  const done = useRef(false);
  const leftNow = () => TEST_SEC + bonus.current - (Date.now() - start.current) / 1000;
  const finish = useCallback((l: number) => { if (done.current) return; done.current = true; onDone(res.current, l); }, [onDone]);
  useEffect(() => {
    const id = setInterval(() => {
      const l = leftNow();
      setLeft(l);
      if (l <= 0) { clearInterval(id); finish(0); }
    }, 100);
    return () => clearInterval(id);
  }, [finish]);

  const choose = (v: number) => {
    if (done.current) return;
    const q = qs[cur];
    const ok = v === q.a;
    res.current[cur] = { w: q.w, ok, answered: true };
    if (ok) bonus.current += BONUS_SEC;
    Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    setFb(ok ? { ok, text: '◯ 正解 +0.5秒' } : { ok, text: `✖ ${q.w.w} ＝ ${q.w.m}` });
    if (cur < qs.length - 1) setCur(cur + 1);
    else finish(leftNow());
  };
  const q = qs[cur];
  const correct = res.current.filter(r => r.ok).length;
  return (
    <Timed ctx={ctx} clock={<Clock ctx={ctx} label={`${kind === 'fix' ? '定着テスト' : kind === 'mix' ? '総合定着テスト' : level.name}　${cur + 1}/${qs.length}問　正解 ${correct}`}
        text={<>{fmt1(left)}<Text style={st.bigUnit}> 秒</Text></>} left={left} total={TEST_SEC}
        extra={
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {qs.map((_, k) => {
              const r = res.current[k];
              return <View key={k} style={{ flex: 1, height: 6, borderRadius: 2, backgroundColor: k === cur ? c.ink : r.answered ? (r.ok ? c.ok : c.ng) : c.line }} />;
            })}
          </View>
        } />}>
      <Text accessibilityLiveRegion="polite" style={{ minHeight: 22, fontSize: 14, fontWeight: '700', color: fb ? (fb.ok ? c.ok : c.ng) : c.muted }}>{fb?.text ?? ' '}</Text>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={st.note}>意味は？</Text><Pos ctx={ctx} p={q.w.p} />
          {q.lv && <Text style={st.note}>{LEVEL[q.lv].name}</Text>}
        </View>
        <Text style={{ fontFamily: F.word, fontSize: 40, fontWeight: '600', color: c.ink }} adjustsFontSizeToFit numberOfLines={1}>{q.w.w}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {q.choices.map((ch, i) => (
          <Pressable key={i} accessibilityRole="button" onPress={() => choose(i)}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, minHeight: 54 }, pressed && { backgroundColor: c.aiSoft }]}>
            <Text style={{ fontFamily: F.num, fontSize: 12, color: c.muted, borderWidth: 1, borderColor: c.line, borderRadius: 4, minWidth: 22, textAlign: 'center', overflow: 'hidden' }}>{i + 1}</Text>
            <Text style={{ fontSize: 16, color: c.ink, flexShrink: 1 }}>{ch}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.note}>正解で0.5秒延びます。得点＝残り秒（切り捨て）＋正解数。</Text>
    </Timed>
  );
}

/* ---------- 結果の共通部品 ---------- */
function ScoreCard({ ctx, label, best, score, left, correct, ng, na, size, foot }: {
  ctx: VCtx; label: string; best?: boolean; score: number; left: number; correct: number; ng: number; na: number; size: number; foot?: string;
}) {
  const { c, st } = ctx;
  const j = judge(score, correct, size);
  const tone = correct / size >= 0.8 ? 'ok' : correct / size >= 0.6 ? 'mid' : 'ng';
  const map = { ok: [c.ok, c.okSoft], mid: [c.warn, c.warnSoft], ng: [c.ng, c.ngSoft] } as const;
  const tally = (color: string, t: string, n: number) => <Text style={{ color, fontSize: 14 }}>{t} <Text style={{ fontFamily: F.num, fontWeight: '600' }}>{n}</Text></Text>;
  return (
    <View style={[st.card, { borderRadius: 12 }]}>
      <View style={st.rowBetween}>
        <Label ctx={ctx}>{label}</Label>
        {best && <Text style={st.tag}>自己ベスト</Text>}
      </View>
      <Text><Text style={{ fontFamily: F.num, fontSize: 56, fontWeight: '600', color: c.ink }}>{score}</Text><Text style={st.bigUnit}> 点</Text></Text>
      <Text style={st.note}>残り {fmt1(left)}秒 ＋ 正解 {correct}問</Text>
      <View style={[st.wrapRow, { gap: 14 }]}>
        {tally(c.ok, '◯ 正解', correct)}
        {tally(c.ng, '✖ 不正解', ng)}
        {tally(c.warn, '△ 時間切れ', na)}
      </View>
      <Text style={[st.judge, { color: map[tone][0], backgroundColor: map[tone][1], alignSelf: 'flex-start', fontSize: 13 }]}>{j}</Text>
      {!!foot && <Text style={st.note}>{foot}</Text>}
    </View>
  );
}

/* ---------- 結果 ---------- */
function ResultView({ ctx, s, lp, again, next, fix, home }: {
  ctx: VCtx; s: Extract<VScreen, { name: 'result' }>; lp: LevelProgress; again: () => void; next: () => void; fix: () => void; home: () => void;
}) {
  const { st } = ctx;
  const { log, res } = s;
  const level = LEVEL[s.id];
  const st2 = stats(level, lp);
  const wrong = res.filter(r => !r.ok);  // 不正解と時間切れ
  return (
    <>
      <ScoreCard ctx={ctx} label={log.kind === 'fix' ? '定着テスト' : level.name} best={log.kind === 'round' && log.score >= st2.best}
        score={log.score} left={log.left} correct={log.correct} ng={res.filter(r => r.answered && !r.ok).length} na={res.filter(r => !r.answered).length} size={log.size}
        foot={`このパックの最高 ${st2.best}点・平均 ${st2.avg}点（${st2.rounds}回）。定着 ${st2.cnt.fixed}語・要再習得 ${st2.cnt.redo}語。`} />
      {s.fixDue && isOwned(level, ctx.unlocked) && (
        <View style={[st.card, st.cardNow, { borderRadius: 12 }]}>
          <Text style={st.h2}>{lp.learned}語を学びました</Text>
          <Text style={st.body}>要再習得などの語だけで、暗記なしの1分テストをして定着を測ります。</Text>
          <Btn ctx={ctx} primary big label="定着テストへ" onPress={fix} />
        </View>
      )}
      <View style={st.wrapRow}>
        {!s.fixDue && log.kind === 'round' && canUse(level, ctx.unlocked, lp) && <Btn ctx={ctx} primary label="次の30語へ" onPress={next} />}
        {log.kind === 'round' && <Btn ctx={ctx} label="同じ30語をもう一度" onPress={again} />}
        <Btn ctx={ctx} label="パックのホームへ" onPress={home} />
      </View>
      {wrong.length > 0 && (
        <View style={[st.card, { borderRadius: 12 }]}>
          <Label ctx={ctx}>間違えた・時間切れの語 · {wrong.length}</Label>
          <View>
            {wrong.map((r, i) => <Entry key={r.w.w} ctx={ctx} w={r.w} first={i === 0} note={r.answered ? '✖ 不正解' : '△ 時間切れ'} top={<StatusTag ctx={ctx} s={statusOf(lp.hist[r.w.w])} />} right={<Marks ctx={ctx} h={lp.hist[r.w.w]} />} />)}
          </View>
          <Text style={st.note}>△（時間切れ）は不正解に数えず、次の30語で復習として出します。</Text>
        </View>
      )}
    </>
  );
}

/* ---------- 総合定着テストの結果 ---------- */
function MixResult({ ctx, s, home, again }: { ctx: VCtx; s: Extract<VScreen, { name: 'mixresult' }>; home: () => void; again: () => void }) {
  const { c, st } = ctx;
  const { qs, res, logs } = s;
  const correct = res.filter(r => r.ok).length;
  const left = Object.values(logs)[0]?.left ?? 0;
  const score = Math.max(0, Math.floor(left + 1e-9)) + correct;
  const wrong = res.map((r, i) => ({ r, lv: qs[i].lv! })).filter(x => !x.r.ok);
  const byLv = Object.entries(logs);
  return (
    <>
      <ScoreCard ctx={ctx} label="総合定着テスト" score={score} left={left} correct={correct}
        ng={res.filter(r => r.answered && !r.ok).length} na={res.filter(r => !r.answered).length} size={res.length} />
      <View style={st.wrapRow}>
        <Btn ctx={ctx} primary label="もう一度（対象を集め直す）" onPress={again} />
        <Btn ctx={ctx} label="パック一覧へ" onPress={home} />
      </View>
      <View style={[st.card, { borderRadius: 12 }]}>
        <Label ctx={ctx}>パックごとの内訳</Label>
        {byLv.map(([lv, l]) => (
          <View key={lv} style={st.histRow}>
            <Text style={st.note}>{LEVEL[lv].name}</Text>
            <Text style={{ fontFamily: F.num, fontSize: 13, color: c.ink }}>{l.correct}/{l.size}</Text>
          </View>
        ))}
      </View>
      {wrong.length > 0 && (
        <View style={[st.card, { borderRadius: 12 }]}>
          <Label ctx={ctx}>間違えた・時間切れの語 · {wrong.length}</Label>
          <View>
            {wrong.map(({ r, lv }, i) => {
              const h = levelOf(ctx.p, lv).hist[r.w.w];
              return <Entry key={lv + r.w.w} ctx={ctx} w={r.w} first={i === 0} note={`${LEVEL[lv].name}　${r.answered ? '✖ 不正解' : '△ 時間切れ'}`} top={<StatusTag ctx={ctx} s={statusOf(h)} />} right={<Marks ctx={ctx} h={h} />} />;
            })}
          </View>
        </View>
      )}
    </>
  );
}
