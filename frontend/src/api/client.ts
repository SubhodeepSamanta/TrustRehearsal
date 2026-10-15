import { useEffect, useState, useRef } from 'react';

const API_BASE = ((import.meta as any).env?.VITE_API_URL || '') + '/api/v1';

let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  currentCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentCsrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
    headers.set('X-CSRF-Token', currentCsrfToken);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    let errorJson;
    try {
      errorJson = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    throw new Error(errorJson?.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export function useRunStream(runId: string | undefined, onEvent: (event: any) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!runId) return;

    const sseUrl = `${API_BASE}/runs/${runId}/stream`;
    const es = new EventSource(sseUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.addEventListener('run-event', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [runId]);

  return { connected };
}
