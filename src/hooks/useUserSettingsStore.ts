/**
 * useUserSettingsStore.ts
 *
 * Central settings lifecycle hook.
 *
 * Responsibilities
 * ────────────────
 *  1. On mount – try to hydrate settings from the AURA extension bridge
 *     (AURA_EXT_ML_FINAL_PROFILE_PING).  Fall back to localStorage if the
 *     extension isn't available.
 *  2. Persist every settings change to localStorage so the state survives
 *     page refreshes even when the extension is offline.
 *  3. Expose `updateSettings(patch, source)` that
 *       a. Merges the patch into the current state
 *       b. Saves to localStorage immediately
 *       c. POSTs to the server so other tabs (SSE) pick it up
 *  4. Schedule an end-of-day ML sync at local midnight (or the configured
 *     `eodHour` option).  The server collects the accumulated history and
 *     forwards it to the ML engine.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AuraProfileV2 } from '../types';

// ─── constants ────────────────────────────────────────────────────────────────
const LS_KEY_PREFIX = 'aura_user_settings_';
const EXT_TIMEOUT_MS = 2000;
const EXT_REQ_TYPE  = 'AURA_EXT_ML_FINAL_PROFILE_PING';
const EXT_RES_TYPE  = 'AURA_EXT_ML_FINAL_PROFILE_PONG';

// ─── types ────────────────────────────────────────────────────────────────────
export type SettingsSource =
  | 'extension'
  | 'localstorage'
  | 'dashboard'
  | 'ml'
  | 'user_feedback'
  | 'user_revert'
  | 'eod_restore';

export interface UseUserSettingsStoreOptions {
  userId: string;
  apiEndpoint: string;
  /** Hour (0-23, local time) at which the EOD ML sync fires.  Default: 23 */
  eodHour?: number;
  onSettingsLoaded?: (profile: Partial<AuraProfileV2>, source: SettingsSource) => void;
  onSettingsUpdated?: (profile: Partial<AuraProfileV2>, source: SettingsSource) => void;
  onEodSyncComplete?: (result: { sent: number }) => void;
}

export interface UseUserSettingsStoreReturn {
  settings: Partial<AuraProfileV2> | null;
  source: SettingsSource | null;
  updateSettings: (patch: Partial<AuraProfileV2>, source?: SettingsSource) => Promise<void>;
  triggerEodSync: () => Promise<void>;
  isLoaded: boolean;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function lsKey(userId: string) {
  return `${LS_KEY_PREFIX}${userId}`;
}

function loadFromLocalStorage(userId: string): Partial<AuraProfileV2> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToLocalStorage(userId: string, profile: Partial<AuraProfileV2>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lsKey(userId), JSON.stringify(profile));
  } catch {
    // quota exceeded – ignore
  }
}

/**
 * Ask the AURA extension for the best available ML profile.
 * Resolves with the profile object, or null on timeout / extension absent.
 */
function fetchProfileFromExtension(timeoutMs: number): Promise<Partial<AuraProfileV2> | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(null); return; }

    const requestId = 'aura_store_' + Math.random().toString(36).slice(2);
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(ev: MessageEvent) {
      const d = ev?.data;
      if (!d || d.__aura !== true) return;
      if (d.type !== EXT_RES_TYPE) return;
      if (d.requestId !== requestId) return;

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);

      const profile = d.profile || null;
      resolve(profile);
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ __aura: true, type: EXT_REQ_TYPE, requestId }, '*');
  });
}

/** ms until the next occurrence of `targetHour:00:00` local time */
function msUntilHour(targetHour: number): number {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// ─── hook ─────────────────────────────────────────────────────────────────────
export function useUserSettingsStore({
  userId,
  apiEndpoint,
  eodHour = 23,
  onSettingsLoaded,
  onSettingsUpdated,
  onEodSyncComplete,
}: UseUserSettingsStoreOptions): UseUserSettingsStoreReturn {
  const [settings, setSettings] = useState<Partial<AuraProfileV2> | null>(null);
  const [source,   setSource]   = useState<SettingsSource | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const settingsRef     = useRef(settings);
  const eodTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoadedRef     = useRef(onSettingsLoaded);
  const onUpdatedRef    = useRef(onSettingsUpdated);
  const onEodRef        = useRef(onEodSyncComplete);

  useEffect(() => { settingsRef.current      = settings;         }, [settings]);
  useEffect(() => { onLoadedRef.current      = onSettingsLoaded; }, [onSettingsLoaded]);
  useEffect(() => { onUpdatedRef.current     = onSettingsUpdated;}, [onSettingsUpdated]);
  useEffect(() => { onEodRef.current         = onEodSyncComplete;}, [onEodSyncComplete]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const base = apiEndpoint.replace(/\/+$/, '');

  const serverGet = useCallback(async (): Promise<Partial<AuraProfileV2> | null> => {
    if (!base || !userId) return null;
    try {
      const res = await fetch(`${base}/settings/${encodeURIComponent(userId)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.found ? (json.profile as Partial<AuraProfileV2>) : null;
    } catch {
      return null;
    }
  }, [base, userId]);

  const serverPost = useCallback(async (
    patch: Partial<AuraProfileV2>,
    src: SettingsSource,
  ): Promise<void> => {
    if (!base || !userId) return;
    try {
      await fetch(`${base}/settings/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: patch, source: src }),
      });
    } catch {
      // best-effort – localStorage is the authoritative client-side store
    }
  }, [base, userId]);

  // ── triggerEodSync ─────────────────────────────────────────────────────────
  const triggerEodSync = useCallback(async () => {
    if (!base || !userId) return;
    try {
      const res = await fetch(
        `${base}/settings/${encodeURIComponent(userId)}/ml-sync`,
        { method: 'POST' },
      );
      if (res.ok) {
        const json = await res.json();
        console.log('[AURA EOD] ML sync complete:', json);
        onEodRef.current?.({ sent: json.sent ?? 0 });
      }
    } catch (err) {
      console.warn('[AURA EOD] ML sync failed (will retry tomorrow):', err);
    }
  }, [base, userId]);

  // ── updateSettings ─────────────────────────────────────────────────────────
  const updateSettings = useCallback(async (
    patch: Partial<AuraProfileV2>,
    src: SettingsSource = 'dashboard',
  ) => {
    const merged = { ...(settingsRef.current ?? {}), ...patch } as Partial<AuraProfileV2>;

    // 1. Update local state
    setSettings(merged);
    setSource(src);

    // 2. Persist to localStorage
    saveToLocalStorage(userId, merged);

    // 3. POST to server (non-blocking) – the server will broadcast SSE
    serverPost(patch, src);

    onUpdatedRef.current?.(merged, src);
    console.log(`[AURA Settings] Updated (${src}):`, Object.keys(patch).join(', '));
  }, [userId, serverPost]);

  // ── initialisation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function init() {
      // Step 1 – try extension bridge (fastest, most accurate)
      const extProfile = await fetchProfileFromExtension(EXT_TIMEOUT_MS);

      if (cancelled) return;

      if (extProfile) {
        const merged = { ...(loadFromLocalStorage(userId) ?? {}), ...extProfile };
        setSettings(merged);
        setSource('extension');
        saveToLocalStorage(userId, merged);
        setIsLoaded(true);
        onLoadedRef.current?.(merged, 'extension');
        console.log('[AURA Settings] Loaded from extension.');
        serverPost(extProfile, 'extension'); // persist to server too
        return;
      }

      // Step 2 – fall back to localStorage
      const cached = loadFromLocalStorage(userId);
      if (cached) {
        setSettings(cached);
        setSource('localstorage');
        setIsLoaded(true);
        onLoadedRef.current?.(cached, 'localstorage');
        console.log('[AURA Settings] Loaded from localStorage.');
      }

      // Step 3 – try server (async, will update state when it arrives)
      const serverProfile = await serverGet();
      if (cancelled) return;
      if (serverProfile) {
        const merged = { ...(cached ?? {}), ...serverProfile };
        setSettings(merged);
        setSource('dashboard');
        saveToLocalStorage(userId, merged);
        setIsLoaded(true);
        onLoadedRef.current?.(merged, 'dashboard');
        console.log('[AURA Settings] Loaded from server.');
      }

      if (!cached && !serverProfile) {
        setIsLoaded(true); // nothing found – let the UI proceed with defaults
      }
    }

    init();
    return () => { cancelled = true; };
  }, [userId, serverGet, serverPost]);

  // ── EOD scheduler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !apiEndpoint) return;

    function scheduleNext() {
      const delay = msUntilHour(eodHour);
      console.log(
        `[AURA EOD] Next sync at ${eodHour}:00 local time ` +
        `(in ${Math.round(delay / 60000)} min)`,
      );
      eodTimerRef.current = setTimeout(async () => {
        await triggerEodSync();
        scheduleNext(); // reschedule for the next day
      }, delay);
    }

    scheduleNext();

    return () => {
      if (eodTimerRef.current) clearTimeout(eodTimerRef.current);
    };
  }, [userId, apiEndpoint, eodHour, triggerEodSync]);

  return { settings, source, updateSettings, triggerEodSync, isLoaded };
}
