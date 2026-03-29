import type { AppState, AppAction, PhoneticSystem } from '../types';

export const MAX_SEQUENCE_LENGTH = 20;

const SYSTEM_STORAGE_KEY = 'phonetic-system';
const VALID_SYSTEMS: PhoneticSystem[] = ['IPA', 'KK', 'Webster'];

export function loadSavedSystem(): PhoneticSystem {
  try {
    const saved = localStorage.getItem(SYSTEM_STORAGE_KEY);
    if (saved && VALID_SYSTEMS.includes(saved as PhoneticSystem)) {
      return saved as PhoneticSystem;
    }
  } catch {
    // localStorage unavailable
  }
  return 'IPA';
}

export function saveSystem(system: PhoneticSystem): void {
  try {
    localStorage.setItem(SYSTEM_STORAGE_KEY, system);
  } catch {
    // localStorage unavailable
  }
}

export const initialState: AppState = {
  currentSystem: loadSavedSystem(),
  sequence: [],
  searchStatus: 'idle',
  results: [],
  fuzzyResults: [],
  selectedWord: null,
  detailLoading: false,
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SWITCH_SYSTEM':
      return {
        ...state,
        currentSystem: action.payload,
        sequence: [],
        searchStatus: 'idle',
        results: [],
        fuzzyResults: [],
        selectedWord: null,
        error: null,
      };

    case 'APPEND_SYMBOL':
      if (state.sequence.length >= MAX_SEQUENCE_LENGTH) {
        return state;
      }
      return {
        ...state,
        sequence: [...state.sequence, action.payload],
      };

    case 'REMOVE_SYMBOL':
      return {
        ...state,
        sequence: state.sequence.filter((_, i) => i !== action.payload),
      };

    case 'CLEAR_SEQUENCE':
      return {
        ...state,
        sequence: [],
      };

    case 'FILL_SEQUENCE':
      return {
        ...state,
        currentSystem: action.payload.system,
        sequence: action.payload.sequence,
      };

    case 'SEARCH_START':
      return {
        ...state,
        searchStatus: 'loading',
        results: [],
        fuzzyResults: [],
        selectedWord: null,
        error: null,
      };

    case 'SEARCH_SUCCESS':
      return {
        ...state,
        searchStatus: 'success',
        results: action.payload.results,
        fuzzyResults: action.payload.fuzzyResults,
      };

    case 'SEARCH_EMPTY':
      return {
        ...state,
        searchStatus: 'empty',
        results: [],
      };

    case 'SEARCH_ERROR':
      return {
        ...state,
        searchStatus: 'error',
        error: action.payload,
      };

    case 'SELECT_WORD_START':
      return {
        ...state,
        detailLoading: true,
      };

    case 'SELECT_WORD':
      return {
        ...state,
        selectedWord: action.payload,
        detailLoading: false,
      };

    case 'SELECT_WORD_ERROR':
      return {
        ...state,
        detailLoading: false,
      };

    case 'DESELECT_WORD':
      return {
        ...state,
        selectedWord: null,
      };

    default:
      return state;
  }
}
