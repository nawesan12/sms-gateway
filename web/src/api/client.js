const TOKEN_KEY = 'sms-gateway-bootstrap-token';
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}
export class ApiError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
export async function apiFetch(path, init = {}) {
    const token = getToken();
    const headers = {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
    };
    if (token)
        headers['x-bootstrap-token'] = token;
    // En dev (Vite en :5173) usamos el proxy /api → backend.
    // Cuando el backend sirve la UI, las rutas son al mismo origen sin prefijo.
    const isViteDev = import.meta.env.DEV && location.port === '5173';
    const url = isViteDev ? `/api${path}` : path;
    const res = await fetch(url, { ...init, headers });
    if (res.status === 204)
        return undefined;
    let body = null;
    try {
        body = (await res.json());
    }
    catch {
        // non-JSON
    }
    if (!res.ok) {
        const code = body?.error?.code;
        const message = body?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403)
            clearToken();
        throw new ApiError(message, res.status, code);
    }
    return (body?.data ?? undefined);
}
