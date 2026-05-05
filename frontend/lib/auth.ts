import { useSyncExternalStore } from "react";

export type StoredUser = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
};

const TOKEN_KEY = "roomtastic.token";
const USER_KEY = "roomtastic.user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: StoredUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// useSyncExternalStore requires a stable reference from getSnapshot.
// Cache by raw JSON string so the same object is returned when nothing changed.
let _cachedUserJson: string | null = null;
let _cachedUser: StoredUser | null = null;

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (raw === _cachedUserJson) return _cachedUser;
  _cachedUserJson = raw;
  if (!raw) { _cachedUser = null; return null; }
  try {
    _cachedUser = JSON.parse(raw) as StoredUser;
  } catch {
    _cachedUser = null;
  }
  return _cachedUser;
}

const _noop = () => () => {};
const _serverNull = () => null;

export function useClientToken(): string | null {
  return useSyncExternalStore(_noop, getToken, _serverNull);
}

export function useClientUser(): StoredUser | null {
  return useSyncExternalStore(_noop, getStoredUser, _serverNull);
}
