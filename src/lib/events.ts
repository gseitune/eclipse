/**
 * In-memory SSE event bus (single instance, local development).
 * NOTE: not horizontally scalable; fine for SQLite local/Single instance.
 */

export interface SseEvent {
  type: string;
  data: unknown;
}

type Listener = (event: SseEvent) => void;

const listeners = new Set<Listener>();

export function subscribeSse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishSse(type: string, data: unknown): void {
  const event: SseEvent = { type, data };
  for (const listener of listeners) listener(event);
}