// 英単語フラッシュ：30語を1分で覚えて1分でテストする英単語アプリ。
// 画面は src/VocabScreens.tsx、ロジックは src/vocab.ts、記録は src/storage.ts（端末内）。
// 2026-10-22 宅建10分模試アプリ（takken-mock-app）から独立した単独アプリとして切り出し。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { VocabApp } from './src/VocabScreens';
import { VocabProgress } from './src/vocab';
import { loadVocab, saveVocab } from './src/storage';
import { makeStyles } from './src/styles';
import { useColors } from './src/theme';

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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadVocab().then(setP); }, []);

  const toTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []);
  const update = useCallback((next: VocabProgress) => { setP(next); saveVocab(next); }, []);

  if (!p) {
    return <View style={[st.fill, st.center]}><ActivityIndicator color={c.ai} /></View>;
  }
  return (
    <SafeAreaView style={st.fill} edges={['top', 'left', 'right']}>
      <StatusBar style="auto" />
      <ScrollView ref={scrollRef}>
        <View style={st.wrap}>
          <VocabApp ctx={{ c, st, p, update, toTop }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
