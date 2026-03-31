/**
 * 音标音频播放服务
 *
 * 使用 ARPAbet 编码作为文件名，从 /audio/{code}.mp3 加载音频。
 * 内部维护 HTMLAudioElement 缓存池，避免重复创建。
 */

const audioCache = new Map<string, HTMLAudioElement>();

/**
 * 播放指定 ARPAbet 音素的音频。
 * 如果音频尚未缓存，会自动创建并缓存。
 * 快速连续点击时会重置播放位置从头播放。
 */
export function playPhoneme(arpabetCode: string): Promise<void> {
  let audio = audioCache.get(arpabetCode);
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}audio/${arpabetCode}.mp3`);
    audioCache.set(arpabetCode, audio);
  }
  audio.currentTime = 0;
  return audio.play().catch(() => {
    // 浏览器在用户未交互时会阻止自动播放，静默处理
  });
}

/**
 * 预加载一组音素音频，减少首次点击延迟。
 */
export function preloadPhonemes(arpabetCodes: string[]): void {
  for (const code of arpabetCodes) {
    if (!audioCache.has(code)) {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/${code}.mp3`);
      audio.preload = 'auto';
      audioCache.set(code, audio);
    }
  }
}

/**
 * 清除音频缓存（主要用于测试）。
 */
export function clearAudioCache(): void {
  audioCache.clear();
}

/**
 * Use Web Speech API to speak a word. Intended as a fallback
 * when no recorded audio URL is available from the dictionary API.
 * Returns true if speech synthesis is supported and utterance was dispatched.
 */
export function speakWord(word: string): boolean {
  if (typeof speechSynthesis === 'undefined') return false;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
  return true;
}
