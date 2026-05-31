// save.js — localStorage auto-save and offline catch-up

const SAVE_KEY = 'gemi_save_v2';
const SAVE_INTERVAL_MS = 30_000;
const MAX_OFFLINE_HOURS = 24;

export const Save = {
  _timer: null,

  start(serializeFn) {
    this._timer = setInterval(() => this._write(serializeFn), SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', () => this._write(serializeFn));
  },

  _write(serializeFn) {
    const data = serializeFn();
    data._savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  getOfflineSeconds(savedAt) {
    if (!savedAt) return 0;
    const elapsed = (Date.now() - savedAt) / 1000;
    return Math.min(elapsed, MAX_OFFLINE_HOURS * 3600);
  },

  clear() {
    localStorage.removeItem(SAVE_KEY);
  },
};
