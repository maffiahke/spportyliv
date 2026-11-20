import type {
  AppUser,
  AuthCredentials,
  AuthResponse,
  SignUpCredentials,
} from '../types/user';

const USER_TOKEN_KEY = 'sportylive_user_token';

export function getUserToken(): string | null {
  try {
    return localStorage.getItem(USER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setUserToken(token: string): void {
  try {
    localStorage.setItem(USER_TOKEN_KEY, token);
  } catch {
    /* storage unavailable — session stays in-memory for this page */
  }
}

export function clearUserToken(): void {
  try {
    localStorage.removeItem(USER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders(): Record<string, string> {
  const token = getUserToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...authHeaders(), ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Bad server response (${res.status})`);
  }
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function registerAccount(credentials: SignUpCredentials): Promise<AppUser> {
  const result = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  setUserToken(result.token);
  return result.user;
}

export async function loginAccount(credentials: AuthCredentials): Promise<AppUser> {
  const result = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  setUserToken(result.token);
  return result.user;
}

/** Returns the signed-in user, or null for a guest. */
export async function fetchCurrentUser(): Promise<AppUser | null> {
  if (!getUserToken()) return null;
  try {
    const result = await request<{ user: AppUser | null }>('/api/auth/me');
    if (!result.user) clearUserToken();
    return result.user;
  } catch {
    return null;
  }
}

export async function logoutAccount(): Promise<void> {
  try {
    if (getUserToken()) {
      await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    }
  } catch {
    /* clear locally even if the server call fails */
  } finally {
    clearUserToken();
  }
}
