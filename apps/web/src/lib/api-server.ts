import { env } from 'env';
import { APICallOptions, APIError, APIErrorBody } from './api';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * makeServerAPICall — helper for making backend requests from Server Components or Route Handlers.
 *
 * Unlike makeAPICall (which uses the browser proxy), this:
 * 1. Calls env.API_URL directly (absolute URL).
 * 2. Automatically forwards the 'tq_auth' session cookie as a Bearer token.
 * 3. Consistently handles errors via APIError.
 */
export async function makeServerAPICall<T = unknown>(path: string, { body, headers, ...rest }: APICallOptions = {}): Promise<T> {
  // Ensure path starts with / for URL construction if it doesn't already, but remove it for URL constructor
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, env.API_URL).toString();

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  // Automatically inject the session token from httpOnly cookies if we are on the server
  try {
    const sessionToken = cookies().get('tq_auth')?.value;
    if (sessionToken && !mergedHeaders['Authorization'] && !mergedHeaders['authorization']) {
      mergedHeaders['Authorization'] = `Bearer ${sessionToken}`;
    }
  } catch {
    // cookies() might throw if called outside of a request context (e.g. build time)
    // We just skip injection in that case.
  }

  const response = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorData: APIErrorBody = await response.json().catch(() => ({}));

    if (response.status === 401 && errorData.code === 'auth/id-token-expired') {
      try {
        cookies().delete('tq_auth');
      } catch {
        // Ignored if called outside of request context
      }
      redirect('/en/login?error=Session Expired');
    }

    throw new APIError(response.status, errorData.message ?? `Request failed with status ${response.status}`, errorData.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Pre-configured helper for /v1/... endpoints on the backend. */
export const makeServerAPICallV1 = <T = unknown>(path: string, options: APICallOptions = {}) => makeServerAPICall<T>(`v1/${path}`, options);
