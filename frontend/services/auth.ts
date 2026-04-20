import { apiFetch } from "@/lib/apiClient";
import type { AuthSessionResponse } from "@/types/api";

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

export function loginWithPassword(input: LoginInput): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function registerWithPassword(input: RegisterInput): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
