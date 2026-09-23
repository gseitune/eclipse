"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StateSnapshot } from "./types";
import { fetchState } from "./api";
import { ApiError } from "./types";

const MEANINGFUL_EVENTS = [
  "result-recorded",
  "standings-changed",
  "schedule-changed",
  "zones-changed",
  "zoning-confirmed",
  "phase-changed",
  "brackets-generated",
  "brackets-blocked",
  "desempate-created",
] as const;

const DEBOUNCE_MS = 250;
const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export function useLiveState(options?: { initial?: StateSnapshot | null }): {
  state: StateSnapshot | null;
  loading: boolean;
  error: string | null;
  lastEvent: string | null;
  refreshing: boolean;
  refetch: () => Promise<void>;
} {
  const hasInitial = options?.initial !== undefined;
  const initialValue: StateSnapshot | null = hasInitial ? options.initial! : null;
  const [state, setState] = useState<StateSnapshot | null>(initialValue);
  const [loading, setLoading] = useState<boolean>(!hasInitial);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_INITIAL_MS);
  const refreshingRef = useRef<boolean>(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef<boolean>(true);

  const performRefetch = useCallback(async () => {
    if (refreshingRef.current) {
      return refreshPromiseRef.current!;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    const promise = (async () => {
      try {
        const snapshot = await fetchState();
        if (mountedRef.current) {
          setState(snapshot);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          const msg = err instanceof ApiError ? err.message : String(err);
          setError(msg);
        }
      } finally {
        if (mountedRef.current) {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
    })();
    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  const refetch = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return performRefetch();
  }, [performRefetch]);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch — skip when initial data provided
    if (!hasInitial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      fetchState()
        .then((snapshot) => {
          if (mountedRef.current) {
            setState(snapshot);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (mountedRef.current) {
            const msg = err instanceof ApiError ? err.message : String(err);
            setError(msg);
            setLoading(false);
          }
        });
    }

    const createSource = () => {
      const es = new EventSource("/api/events");
      esRef.current = es;

      // Ignore control events
      es.addEventListener("ready", () => {});
      es.addEventListener("heartbeat", () => {});

      // Meaningful events: set lastEvent and debounced refetch
      for (const type of MEANINGFUL_EVENTS) {
        es.addEventListener(type, () => {
          if (!mountedRef.current) return;
          setLastEvent(type);
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            performRefetch();
          }, DEBOUNCE_MS);
        });
      }

      es.onopen = () => {
        reconnectDelayRef.current = RECONNECT_INITIAL_MS;
        setError(null);
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setError("Conectando...");
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        const delay = reconnectDelayRef.current;
        reconnectTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          createSource();
          performRefetch();
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            RECONNECT_MAX_MS,
          );
        }, delay);
      };
    };

    createSource();

    return () => {
      mountedRef.current = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [performRefetch, hasInitial]);

  return { state, loading, error, lastEvent, refreshing, refetch };
}
