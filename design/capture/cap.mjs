// ストア用スクリーンショット（1179×2556＝393×852 の3倍）を Web 書き出しから撮る
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const [,, WEB, SEED, VOCAB, OUT] = process.argv; mkdirSync(OUT, { recursive: true });
const meaning = {}; for (const L of JSON.parse(readFileSync(VOCAB, 'utf8'))) for (const w of L.words) meaning[w.w] = w.m;
const srv = spawn('python3', ['-m', 'http.server', '8791', '--directory', WEB], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(800);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 393, height: 852, deviceScaleFactor: 3 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await p.goto('http://localhost:8791/', { waitUntil: 'networkidle0' });
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('vocab-progress-v1', s); localStorage.setItem('unlock-v1:toeic700', '1'); localStorage.setItem('unlock-v1:toeic600', '1'); }, readFileSync(SEED, 'utf8'));
await p.reload({ waitUntil: 'networkidle0' }); await wait(1200);
const shot = async n => { await wait(600); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
const click = async (pred) => { const ok = await p.$$eval('[role=button]', (es, s) => { const f = new Function('t', 'return ' + s); const e = es.find(e => f(e.textContent.trim())); if (e) { e.click(); return true; } return false; }, pred); if (!ok) throw new Error('no button ' + pred); await wait(700); };
const scrollTo = async (text) => p.evaluate((text) => {
  const el = [...document.querySelectorAll('div')].find(d => d.childElementCount === 0 && d.textContent.trim().startsWith(text));
  let s = el; while (s && !(s.scrollHeight > s.clientHeight + 4 && getComputedStyle(s).overflowY !== 'visible')) s = s.parentElement;
  if (s && el) s.scrollTop += el.getBoundingClientRect().top - s.getBoundingClientRect().top - 12;
}, text);
const word = () => p.evaluate(() => { const e = [...document.querySelectorAll('div')].find(d => d.childElementCount === 0 && getComputedStyle(d).fontSize === '40px'); return e ? e.textContent.trim() : null; });

await shot('1_list');
await click("t.startsWith('スコア700目安')");
await shot('4_home');
await scrollTo('語彙マップ'); await shot('5_map');
await scrollTo('単語ごとの成績'); await shot('6_words');
await p.evaluate(() => document.querySelectorAll('div').forEach(d => { if (d.scrollTop) d.scrollTop = 0; }));
await click("t.startsWith('30語を覚える')"); await wait(2500); await shot('2_memo');
await click("t.startsWith('テストへ')");
let n = 0;
for (let k = 0; k < 30; k++) {
  const w = await word(); if (!w) break;
  const right = meaning[w];
  const wrongOnPurpose = k === 2 || k === 9 || k === 17;
  await p.$$eval('[role=button]', (es, right, wrong) => { const cs = es.filter(e => /^[1-4]/.test(e.textContent.trim())); const e = wrong ? cs.find(e => !e.textContent.includes(right)) : cs.find(e => e.textContent.trim().slice(1) === right); (e || cs[0]).click(); }, right, wrongOnPurpose);
  await wait(wrongOnPurpose && k === 2 ? 400 : 650);
  if (k === 2) await shot('3_test');
  n++;
}
await wait(1500); await shot('7_result');
await click("t.startsWith('パックのホームへ')"); await click("t.startsWith('‹ パック一覧')");
await click("t.startsWith('金融')"); await shot('8_buy');
await b.close(); srv.kill();
