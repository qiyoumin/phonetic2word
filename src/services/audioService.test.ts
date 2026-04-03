import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playPhoneme, preloadPhonemes, clearAudioCache } from './audioService';

// Mock HTMLAudioElement
const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockAudioInstances: Array<{ src: string; currentTime: number; preload: string; play: typeof mockPlay }> = [];

vi.stubGlobal('Audio', vi.fn().mockImplementation((src: string) => {
  const instance = {
    src,
    currentTime: 0,
    preload: '',
    play: mockPlay,
  };
  mockAudioInstances.push(instance);
  return instance;
}));

beforeEach(() => {
  clearAudioCache();
  mockAudioInstances.length = 0;
  mockPlay.mockClear();
  (globalThis.Audio as ReturnType<typeof vi.fn>).mockClear();
});

describe('audioService', () => {
  describe('playPhoneme', () => {
    it('创建 Audio 对象并播放', async () => {
      await playPhoneme('AE');
      expect(globalThis.Audio).toHaveBeenCalledWith(expect.stringContaining('audio/AE.mp3'));
      expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it('重复调用复用缓存的 Audio 对象', async () => {
      await playPhoneme('AE');
      await playPhoneme('AE');
      expect(globalThis.Audio).toHaveBeenCalledTimes(1);
      expect(mockPlay).toHaveBeenCalledTimes(2);
    });

    it('快速连续点击时重置 currentTime', async () => {
      await playPhoneme('AE');
      const instance = mockAudioInstances[0];
      instance.currentTime = 0.5;
      await playPhoneme('AE');
      expect(instance.currentTime).toBe(0);
    });

    it('play 失败时静默处理不抛异常', async () => {
      mockPlay.mockRejectedValueOnce(new DOMException('NotAllowedError'));
      await expect(playPhoneme('AE')).resolves.toBeUndefined();
    });

    it('play 返回 undefined 时也不会抛异常', async () => {
      const originalAudio = globalThis.Audio;
      const playWithoutPromise = vi.fn(() => undefined);
      const audioStub = vi.fn().mockImplementation((src: string) => ({
        src,
        currentTime: 0,
        preload: '',
        play: playWithoutPromise,
      }));
      vi.stubGlobal('Audio', audioStub);

      try {
        await expect(playPhoneme('AE')).resolves.toBeUndefined();
        expect(playWithoutPromise).toHaveBeenCalledTimes(1);
      } finally {
        vi.stubGlobal('Audio', originalAudio);
      }
    });

    it('不同音素创建不同 Audio 对象', async () => {
      await playPhoneme('AE');
      await playPhoneme('P');
      expect(globalThis.Audio).toHaveBeenCalledTimes(2);
      expect(mockAudioInstances[0].src).toContain('AE.mp3');
      expect(mockAudioInstances[1].src).toContain('P.mp3');
    });
  });

  describe('preloadPhonemes', () => {
    it('预加载创建 Audio 对象并设置 preload', () => {
      preloadPhonemes(['AA', 'AE', 'B']);
      expect(globalThis.Audio).toHaveBeenCalledTimes(3);
      expect(mockAudioInstances.every((a) => a.preload === 'auto')).toBe(true);
    });

    it('不重复预加载已缓存的音素', () => {
      preloadPhonemes(['AA']);
      preloadPhonemes(['AA', 'AE']);
      // AA 只创建一次，AE 创建一次
      expect(globalThis.Audio).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAudioCache', () => {
    it('清除缓存后重新创建 Audio 对象', async () => {
      await playPhoneme('AE');
      expect(globalThis.Audio).toHaveBeenCalledTimes(1);
      clearAudioCache();
      await playPhoneme('AE');
      expect(globalThis.Audio).toHaveBeenCalledTimes(2);
    });
  });
});
