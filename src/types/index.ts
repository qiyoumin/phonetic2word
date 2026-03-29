// 音标体系枚举
export type PhoneticSystem = 'IPA' | 'KK' | 'Webster';

// 音标符号分类
export type SymbolCategory = 'vowel' | 'consonant';

// 单个音标符号数据
export interface PhoneticSymbolData {
  symbol: string;
  arpabetCode: string;
  category: SymbolCategory;
  example: string;
  system: PhoneticSystem;
}

// 音标序列中的符号（带位置索引）
export interface PhoneticSymbol {
  symbol: string;
  arpabetCode: string;
  index: number;
}

// 查询结果中的单词
export interface WordResult {
  word: string;
  phonetic: string;
  arpabet: string;
  partOfSpeech: string[];
  briefDefinition: string;
}

// 模糊匹配结果
export interface FuzzyWordResult extends WordResult {
  similarity: number;
  diffIndices: number[];
}

// 单词详情
export interface WordDetail {
  word: string;
  phonetic: string;
  meanings: Meaning[];
  audioUrl?: string;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

export interface Definition {
  definition: string;
  definitionCn?: string;
  example?: string;
}


// 查询历史记录
export interface HistoryRecord {
  id: string;
  timestamp: number;
  system: PhoneticSystem;
  sequence: PhoneticSymbol[];
  matchedWords: string[];
}

// 应用状态
export interface AppState {
  currentSystem: PhoneticSystem;
  sequence: PhoneticSymbol[];
  searchStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  results: WordResult[];
  fuzzyResults: FuzzyWordResult[];
  selectedWord: WordDetail | null;
  error: string | null;
}

export type AppAction =
  | { type: 'SWITCH_SYSTEM'; payload: PhoneticSystem }
  | { type: 'APPEND_SYMBOL'; payload: PhoneticSymbol }
  | { type: 'REMOVE_SYMBOL'; payload: number }
  | { type: 'CLEAR_SEQUENCE' }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; payload: { results: WordResult[]; fuzzyResults: FuzzyWordResult[] } }
  | { type: 'SEARCH_EMPTY' }
  | { type: 'SEARCH_ERROR'; payload: string }
  | { type: 'SELECT_WORD'; payload: WordDetail }
  | { type: 'FILL_SEQUENCE'; payload: { system: PhoneticSystem; sequence: PhoneticSymbol[] } }
  | { type: 'DESELECT_WORD' };

// PhoneticIndex for index shards
export interface PhoneticIndex {
  [phoneticKey: string]: string[];
}
