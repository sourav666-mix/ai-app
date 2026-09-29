// src/hooks/useSettings.js
// Settings + API key state (~60 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  useSettings — app settings + API key, persisted via storage.js
// ═══════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS } from '../config/constants';
import {
  getSettings as loadSettings,
  saveSettings,
  getApiKey as loadApiKey,
  setApiKey as persistApiKey,
  removeApiKey as clearStoredApiKey,
} from '../lib/storage';

export function useSettings() {
  const [settings, setSettingsState] = useState(() => loadSettings());
  const [apiKey, setApiKeyState] = useState(() => loadApiKey());

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...DEFAULT_SETTINGS, ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const fresh = { ...DEFAULT_SETTINGS };
    saveSettings(fresh);
    setSettingsState(fresh);
  }, []);

  const saveApiKey = useCallback((key) => {
    const clean = (key || '').trim();
    persistApiKey(clean);
    setApiKeyState(clean);
    return !!clean;
  }, []);

  const clearApiKey = useCallback(() => {
    clearStoredApiKey();
    setApiKeyState('');
  }, []);

  return useMemo(
    () => ({
      settings,
      apiKey,
      hasApiKey: !!apiKey,
      updateSettings,
      resetSettings,
      saveApiKey,
      clearApiKey,
    }),
    [settings, apiKey, updateSettings, resetSettings, saveApiKey, clearApiKey]
  );
}