/**
 * 音素替换辅助模块
 *
 * 从 searchWorker.ts 提取的纯函数，用于音素近似替换的预过滤。
 * 包含 CLOSE_PAIRS 配对数据、closeSubstituteMap 查找表，
 * 以及 getSubstituteCandidates / isCloseSubstitute 两个查询函数。
 */

/** 被视为"近似替换"的音素配对，用于模糊搜索预过滤 */
export const CLOSE_PAIRS: [string, string][] = [
  // Voicing pairs
  ['P', 'B'], ['T', 'D'], ['K', 'G'], ['F', 'V'],
  ['S', 'Z'], ['TH', 'DH'], ['SH', 'ZH'], ['CH', 'JH'],
  // Same manner
  ['S', 'SH'], ['Z', 'ZH'],
  // Vowel length
  ['IY', 'IH'], ['UW', 'UH'], ['AA', 'AH'], ['AO', 'AH'],
];

/** 双向查找表：phoneme → 其所有近似替换音素 */
export const closeSubstituteMap = new Map<string, Set<string>>();

for (const [a, b] of CLOSE_PAIRS) {
  if (!closeSubstituteMap.has(a)) closeSubstituteMap.set(a, new Set());
  if (!closeSubstituteMap.has(b)) closeSubstituteMap.set(b, new Set());
  closeSubstituteMap.get(a)!.add(b);
  closeSubstituteMap.get(b)!.add(a);
}

/** 获取指定音素的所有近似替换候选 */
export function getSubstituteCandidates(phoneme: string): string[] {
  return Array.from(closeSubstituteMap.get(phoneme) ?? []);
}

/** 判断两个音素是否为近似替换关系 */
export function isCloseSubstitute(a: string, b: string): boolean {
  return closeSubstituteMap.get(a)?.has(b) ?? false;
}
