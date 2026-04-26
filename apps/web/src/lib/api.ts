// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface APICallOptions extends Omit<RequestInit, 'body'> {
  /** Request body — will be JSON-serialised automatically. */
  body?: unknown;
}

export interface APIErrorBody {
  message?: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Calls the Next.js API proxy at the given endpoint path.
 *
 * All requests are routed through `/api/[...slug]` (same-origin) which
 * transparently forwards them to the real backend. The actual backend URL
 * never reaches the browser bundle.
 *
 * - Serialises `body` to JSON and sets `Content-Type: application/json`.
 * - Attaches `Authorization: Bearer <token>` when `token` is provided.
 * - Throws an {@link APIError} for non-2xx responses (with the server's
 *   `message` / `code` when available).
 *
 * @example
 * const data = await makeAPICall('/auth/sync', { method: 'POST', body: { idToken } });
 */
export async function makeAPICall<T = unknown>(path: string, { body, headers, ...rest }: APICallOptions = {}): Promise<T> {
  // Prepend the Next.js proxy prefix — callers pass the raw backend path (e.g. /v1/drops/on-demand)
  const url = `/api${path}`;
  const mergedHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const response = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorData: APIErrorBody = await response.json().catch(() => ({}));
    throw new APIError(response.status, errorData.message ?? `Request failed with status ${response.status}`, errorData.code);
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const makeAPICallV1 = <T = unknown>(path: string, options: APICallOptions = {}) => makeAPICall<T>(`/v1/${path}`, options);
