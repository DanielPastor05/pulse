export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; query?: Record<string, string | number | boolean | undefined> };

function buildUrl(path: string, query?: RequestOptions['query']) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Thin typed wrapper over fetch for our own API.
 * Always same-origin and cookie-based, so no token juggling on the client.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;

  const response = await fetch(buildUrl(`/api${path}`, query), {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? 'Something went wrong.';
    const code =
      payload && typeof payload === 'object' && 'code' in payload
        ? String((payload as { code: unknown }).code)
        : 'unknown';
    const details =
      payload && typeof payload === 'object' && 'details' in payload
        ? (payload as { details: unknown }).details
        : undefined;
    throw new ApiError(message, response.status, code, details);
  }

  return payload as T;
}
