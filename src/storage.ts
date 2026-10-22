// 学習記録の保存（端末内）。キーは宅建アプリ同居時と同じ vocab-progress-v1。
// 将来クラウド同期を足すときはここに push/pull を追加する。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyLevel, emptyVocab, LEVEL_ALIAS, LevelProgress, VocabProgress } from './vocab';

// 英単語の記録（レベルごとの cursor・履歴・ログをまとめて1キーに保存）
const VOCAB_KEY = 'vocab-progress-v1';

export async function loadVocab(): Promise<VocabProgress> {
  try {
    const raw = await AsyncStorage.getItem(VOCAB_KEY);
    if (!raw) return emptyVocab();
    const d = JSON.parse(raw);
    const levels: VocabProgress['levels'] = {};
    Object.entries(d.levels || {}).forEach(([rawId, v]) => {
      const id = LEVEL_ALIAS[rawId] ?? rawId; // 旧レベルidの記録を引き継ぐ
      const L = v as Partial<LevelProgress>;
      if (levels[id]) return;
      levels[id] = { ...emptyLevel(), ...L, hist: L.hist && typeof L.hist === 'object' ? L.hist : {}, log: Array.isArray(L.log) ? L.log : [] };
    });
    return { v: 1, levels };
  } catch {
    return emptyVocab();
  }
}

export async function saveVocab(p: VocabProgress): Promise<void> {
  try { await AsyncStorage.setItem(VOCAB_KEY, JSON.stringify(p)); } catch {}
}

// パックの購入記録（パックid または ALL_SKU ごと）。復元・購入のたびに上書きする
const UNLOCK = 'unlock-v1:';
export async function loadUnlocked(ids: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  await Promise.all(ids.map(async id => { try { out[id] = (await AsyncStorage.getItem(UNLOCK + id)) === '1'; } catch { out[id] = false; } }));
  return out;
}
export async function saveUnlocked(id: string, on: boolean): Promise<void> {
  try { on ? await AsyncStorage.setItem(UNLOCK + id, '1') : await AsyncStorage.removeItem(UNLOCK + id); } catch {}
}
