// スクリーンショット用の学習記録（見本）を作る
import { writeFileSync } from 'node:fs';
import { LEVEL, emptyVocab, ensureOrd, nextWords, finishRound, fixDue, fixWords, finishFix, rng, VocabProgress } from '../../src/vocab';
const r = rng(42);
const p: VocabProgress = emptyVocab();
function play(id: string, rounds: number, rate: number, naTail = 0, reps = 0) {
  const sets: any[] = [];
  const L = LEVEL[id];
  let lp = ensureOrd(L, p.levels[id] ?? { cursor: 0, learned: 0, lastFix: 0, hist: {}, log: [] }, r);
  for (let k = 0; k < rounds; k++) {
    if (fixDue(lp)) { const fw = fixWords(L, lp); lp = finishFix(lp, fw.map(w => ({ w, ok: r() < rate + 0.05, answered: true })), 18).next; }
    const ws = nextWords(L, lp); sets.push(ws);
    const res = ws.map((w, i) => ({ w, answered: i < ws.length - naTail, ok: i < ws.length - naTail && r() < rate }));
    const ok = res.filter(x => x.ok).length;
    lp = finishRound(lp, L, res, Math.max(0, 8 + ok * 0.5 - (30 - ok) * 1.2 + r() * 6), false).next;
  }
  // 前に覚えた30語を「もう一度」で繰り返す（定着した語ができる）
  for (let k = 0; k < reps; k++) for (const ws of sets.slice(0, 5)) {
    lp = finishRound(lp, L, ws.map((w: any) => ({ w, answered: true, ok: r() < 0.96 })), 20, true).next;
  }
  p.levels[id] = lp;
}
play('toeic500', 22, 0.93);
play('toeic700', 8, 0.78, 2, 3);
play('toeic600', 4, 0.85);
play('finance', 1, 0.7);
writeFileSync(process.argv[2], JSON.stringify(p));
console.log('seed ok');
