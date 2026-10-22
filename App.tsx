// 英単語フラッシュ：30語を1分で覚えて1分でテストする英単語アプリ。
// 画面は src/VocabScreens.tsx、ロジックは src/vocab.ts、記録は src/storage.ts（端末内）、課金は src/purchase.ts（パックごとの買い切り）。
// 2026-10-22 宅建10分模試アプリ（takken-mock-app）から独立した単独アプリとして切り出し。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Shop, VocabApp } from './src/VocabScreens';
import { ALL_SKU, LEVELS, VocabProgress } from './src/vocab';
import { loadUnlocked, loadVocab, saveUnlocked, saveVocab } from './src/storage';
import { StoreState, buy, restore, startStore } from './src/purchase';
import { makeStyles } from './src/styles';
import { useColors } from './src/theme';

// 表示用の目安。実際の価格はストアから取得したものを優先
const PRICE_LABEL: Record<string, string> = { default: '600円', [ALL_SKU]: '3,000円' };
// 商品ID → パックid（全部入りは ALL_SKU のまま）
const SKUS: Record<string, string> = Object.fromEntries([...LEVELS.filter(L => L.sku).map(L => [L.sku, L.id]), [ALL_SKU, ALL_SKU]]);
const UNLOCK_IDS = [...LEVELS.map(L => L.id), ALL_SKU];

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const c = useColors();
  const st = useMemo(() => makeStyles(c), [c]);
  const [p, setP] = useState<VocabProgress | null>(null);
  const [unlocked, setUnlocked] = useState<Record<string, boolean> | null>(null);
  const [store, setStore] = useState<Record<string, StoreState>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const unlock = useCallback((id: string, on = true) => {
    setUnlocked(u => ({ ...(u ?? {}), [id]: on }));
    saveUnlocked(id, on);
  }, []);

  useEffect(() => {
    Promise.all([loadVocab(), loadUnlocked(UNLOCK_IDS)]).then(([v, u]) => { setP(v); setUnlocked(u); });
    // ストアに接続：価格の取得と購入済みの確認（購入・復元の結果もここに届く）
    startStore(Object.keys(SKUS), {
      onUnlocked: sku => { if (SKUS[sku]) { unlock(SKUS[sku]); setMsg('パックを解放しました。'); } },
      onError: m => setMsg(m),
    }).then(setStore);
  }, [unlock]);

  const toTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []);
  const update = useCallback((next: VocabProgress) => { setP(next); saveVocab(next); }, []);

  if (!p || !unlocked) {
    return <View style={[st.fill, st.center]}><ActivityIndicator color={c.ai} /></View>;
  }
  const shop: Shop = {
    msg,
    price: sku => store[sku]?.price ?? PRICE_LABEL[sku] ?? PRICE_LABEL.default,
    buy: sku => { setMsg(null); buy(sku).catch(e => setMsg(String(e?.message ?? e))); },
    restore: () => {
      setMsg(null);
      restore(Object.keys(SKUS), sku => unlock(SKUS[sku]))
        .then(n => setMsg(n ? `${n}件の購入を復元しました。` : 'この Apple ID での購入記録は見つかりませんでした。'))
        .catch(e => setMsg(String(e?.message ?? e)));
    },
    devToggle: __DEV__ ? id => unlock(id, !unlocked[id]) : undefined,
  };
  return (
    <SafeAreaView style={st.fill} edges={['top', 'left', 'right']}>
      <StatusBar style="auto" />
      <ScrollView ref={scrollRef}>
        <View style={st.wrap}>
          <VocabApp ctx={{ c, st, p, update, toTop, unlocked, shop }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
