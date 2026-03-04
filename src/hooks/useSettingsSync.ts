// src/hooks/useSettingsSync.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { AuraProfileV2 } from '../types';

interface SettingsUpdateEvent {
  type: 'settings_update' | 'connected';
  userId: string;
  source?: 'manual' | 'ml' | 'trial';
  settings?: any;
  timestamp?: string;
}

interface UseSettingsSyncOptions {
  userId: string;
  apiEndpoint: string;
  enabled?: boolean;
  onSettingsUpdate?: (settings: any, source: string) => void;
  onConnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to sync settings in real-time via Server-Sent Events (SSE)
 * Listens for settings changes from dashboard and applies them automatically
 */
export function useSettingsSync({
  userId,
  apiEndpoint,
  enabled = true,
  onSettingsUpdate,
  onConnect,
  onError,
}: UseSettingsSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  
  // Use refs for callbacks to avoid recreating connect function
  const onSettingsUpdateRef = useRef(onSettingsUpdate);
  const onConnectRef = useRef(onConnect);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onSettingsUpdateRef.current = onSettingsUpdate;
    onConnectRef.current = onConnect;
    onErrorRef.current = onError;
  }, [onSettingsUpdate, onConnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      console.log('[AURA SSE] Disconnecting');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !userId || !apiEndpoint) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const url = `${apiEndpoint}/api/settings-events/${userId}`;
      console.log('[AURA SSE] Connecting to:', url);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[AURA SSE] Connection opened');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        onConnectRef.current?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SettingsUpdateEvent = JSON.parse(event.data);
          console.log('[AURA SSE] Received event:', data);

          if (data.type === 'connected') {
            console.log('[AURA SSE] Connected for user:', data.userId);
          } else if (data.type === 'settings_update' && data.settings) {
            console.log('[AURA SSE] Settings updated from:', data.source);
            setLastUpdate(new Date(data.timestamp || Date.now()));
            onSettingsUpdateRef.current?.(data.settings, data.source || 'unknown');
          }
        } catch (error) {
          console.error('[AURA SSE] Error parsing message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[AURA SSE] Connection error:', error);
        setIsConnected(false);
        eventSource.close();

        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        console.log(`[AURA SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);

        onErrorRef.current?.(new Error('SSE connection error'));
      };
    } catch (error) {
      console.error('[AURA SSE] Failed to create EventSource:', error);
      onErrorRef.current?.(error as Error);
    }
  }, [enabled, userId, apiEndpoint]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Reconnect if userId or apiEndpoint changes
  useEffect(() => {
    if (isConnected) {
      disconnect();
      connect();
    }
  }, [userId, apiEndpoint]);

  return {
    isConnected,
    lastUpdate,
    reconnect: connect,
    disconnect,
  };
}