// src/lib/storage.js
// localStorage layer + memory fallback, custom models, favorites (~135 lines) [Batch 1]
// ═══════════════════════════════════════════════════════════════
//  Local-first persistence layer (localStorage with in-memory
//  fallback for private-mode browsers)
// ═══════════════════════════════════════════════════════════════

import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../config/constants';

const memoryStore = new Map();

const available = (() => {
  try {
    localStorage.setItem('__nova_test__', '1');
    localStorage.removeItem('__nova_test__');
    return true;
  } catch {
    return false;
  }
})();

// ── Generic JSON get/set ──────────────────────────────────────
export function storageGet(key, fallback = null) {
  if (!available) return memoryStore.has(key) ? memoryStore.get(key) : fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function storageSet(key, value) {
  if (!available) {
    memoryStore.set(key, value);
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[storage] write failed (quota?)', key, e);
    return false;
  }
}

export function storageRemove(key) {
  if (!available) {
    memoryStore.delete(key);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

// ── API key ───────────────────────────────────────────────────
export const getApiKey = () => storageGet(STORAGE_KEYS.API_KEY, '');
export const setApiKey = (key) => storageSet(STORAGE_KEYS.API_KEY, key || '');
export const removeApiKey = () => storageRemove(STORAGE_KEYS.API_KEY);

// ── Settings ──────────────────────────────────────────────────
export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...storageGet(STORAGE_KEYS.SETTINGS, {}) };
}

export function saveSettings(settings) {
  return storageSet(STORAGE_KEYS.SETTINGS, settings);
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  saveSettings(next);
  return next;
}

export const resetSettings = () => storageRemove(STORAGE_KEYS.SETTINGS);

// ── Chats ─────────────────────────────────────────────────────
export const getChats = () => storageGet(STORAGE_KEYS.CHATS, []);
export const saveChats = (chats) => storageSet(STORAGE_KEYS.CHATS, chats.slice(0, 200));
export const getActiveChatId = () => storageGet(STORAGE_KEYS.ACTIVE_CHAT_ID, null);
export const setActiveChatId = (id) => storageSet(STORAGE_KEYS.ACTIVE_CHAT_ID, id);

// ── Custom models (added via Model Manager, Batch 4) ──────────
export const getCustomModels = () => storageGet(STORAGE_KEYS.CUSTOM_MODELS, []);
export const saveCustomModels = (models) => storageSet(STORAGE_KEYS.CUSTOM_MODELS, models);

export function addCustomModel(model) {
  const list = getCustomModels().filter((m) => m.id !== model.id);
  list.push(model);
  saveCustomModels(list);
  return list;
}

export function removeCustomModel(id) {
  const list = getCustomModels().filter((m) => m.id !== id);
  saveCustomModels(list);
  return list;
}

// ── Favorite models ───────────────────────────────────────────
export const getFavoriteModels = () => storageGet(STORAGE_KEYS.FAVORITE_MODELS, []);
export const saveFavoriteModels = (ids) => storageSet(STORAGE_KEYS.FAVORITE_MODELS, ids);

export function toggleFavoriteModel(id) {
  const favs = getFavoriteModels();
  const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
  saveFavoriteModels(next);
  return next;
}

// ── Danger zone ───────────────────────────────────────────────
export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(storageRemove);
}