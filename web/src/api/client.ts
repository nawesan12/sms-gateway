const TOKEN_KEY = 'sms-gateway-bootstrap-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string; details?: unknown } | null;
  meta: { requestId: string; timestamp: string };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  // Mandamos los dos headers a la vez. El plugin auth-admin del backend
  // chequea x-bootstrap-token primero (operador con env token); si no matchea,
  // intenta Authorization Bearer (access token estático del cliente o JWT).
  if (token) {
    headers['x-bootstrap-token'] = token;
    headers.authorization = `Bearer ${token}`;
  }

  // En dev (Vite en :5173) usamos el proxy /api → backend.
  // Cuando el backend sirve la UI, las rutas son al mismo origen sin prefijo.
  const isViteDev = import.meta.env.DEV && location.port === '5173';
  const url = isViteDev ? `/api${path}` : path;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 204) return undefined as unknown as T;
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON
  }
  if (!res.ok) {
    const code = body?.error?.code;
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) clearToken();
    throw new ApiError(message, res.status, code);
  }
  return (body?.data ?? (undefined as unknown)) as T;
}
