// Temporary browser-only storage. No requests are sent to any database.
const PREFIX = 'burger-house-preview-v1:';
const CHANGE_EVENT = 'burger-house-local-change';
export function readLocal<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return structuredClone(fallback);
  try { return JSON.parse(raw) as T; } catch { return structuredClone(fallback); }
}
export function writeLocal<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}
export function subscribeLocal<T>(key: string, fallback: T, callback: (value: T) => void): () => void {
  const notify = () => callback(readLocal(key, fallback));
  const onChange = (event: Event) => { if ((event as CustomEvent<string>).detail === key) notify(); };
  const onStorage = (event: StorageEvent) => { if (event.key === PREFIX + key || event.key === null) notify(); };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  notify();
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener('storage', onStorage); };
}

