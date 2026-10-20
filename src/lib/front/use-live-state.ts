"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StateSnapshot, Circuit } from "./types";
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
  "etapa-deleted",
] as const;

const DEBOUNCE_MS = 250;
const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 15000;
/** Safety-net refresh: SSE events can be published from another instance. */
const POLL_MS = 10000;

export function useLiveState(options?: {
  initial?: StateSnapshot | null;
  /** Circuit (annual season) to read. Defaults to the API's own default. */
  circuit?: Circuit;
}): {
  state: StateSnapshot | null;
  loading: boolean;
  error: string | null;
  lastEvent: string | null;
  refreshing: boolean;
  refetch: () => Promise<void>;
} {
  const hasInitial = options?.initial !== undefined;
  const initialValue: StateSnapshot | null = hasInitial ? options.initial! : null;
  const circuit = options?.circuit;
  const [state, setState] = useState<StateSnapshot | null>(initialValue);
  // Which circuit the data in `state` belongs to. The snapshot and the fetched
  // stages are tagged, so a circuit switch can never render the other circuit's
  // groups and brackets while the new ones are loading (or after a failure).
  const [dataCircuit, setDataCircuit] = useState<Circuit | undefined>(circuit);
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
  const firstRunRef = useRef<boolean>(true);

  const performRefetch = useCallback(async () => {
    if (refreshingRef.current) {
      return refreshPromiseRef.current!;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    const promise = (async () => {
      try {
        const snapshot = await fetchState(circuit);
        if (mountedRef.current) {
          setState(snapshot);
          setDataCircuit(circuit);
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
  }, [circuit]);

  const refetch = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return performRefetch();
  }, [performRefetch]);

  useEffect(() => {
    mountedRef.current = true;
    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;

    // Initial fetch — skip when initial data provided, except when the circuit
    // changes: the SSR snapshot belongs to the previous circuit.
    if (!hasInitial || !isFirstRun) {
      setLoading(true);
      fetchState(circuit)
        .then((snapshot) => {
          if (mountedRef.current) {
            setState(snapshot);
            setDataCircuit(circuit);
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

    // Serverless makes SSE unreliable: a write can land in another instance than
    // the one holding this connection, so its event never arrives. Poll as a
    // safety net, and refetch as soon as the tab comes back to the front.
    const poll = setInterval(() => {
      if (!mountedRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      performRefetch();
    }, POLL_MS);

    const onWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      performRefetch();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onWake);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onWake);
    }

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onWake);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onWake);
      }
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
  }, [performRefetch, hasInitial, circuit]);

  // Data from another circuit is not "state": it is hidden until the matching
  // one arrives, so Principiantes can never leak into the Intermedios view.
  const sameCircuit = dataCircuit === circuit;

  return {
    state: sameCircuit ? state : null,
    loading: loading || !sameCircuit,
    error,
    lastEvent,
    refreshing,
    refetch,
  };
}
