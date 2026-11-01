// 発音：iPhone 内蔵の音声で読み上げる（音声ファイルは持たない）
import * as Speech from 'expo-speech';

const LANG = 'en-US';

export function speak(text: string, rate = 0.9) {
  Speech.stop();
  Speech.speak(text, { language: LANG, rate, useApplicationAudioSession: false });   // 消音スイッチがオンでも聞こえるように、音声は OS 側のセッションで鳴らす
}

export function stopSpeaking() {
  Speech.stop();
}
