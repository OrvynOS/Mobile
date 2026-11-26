import { API_URL } from "./config";

/** The session token (set by the session provider), sent as `Authorization: Bearer`. */
let token: string | null = null;
export const setApiToken = (value: string | null) => {
  token = value;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Called when the API says the session is gone (expired / signed out elsewhere). */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

/** Demo mode: requests are answered on the device from sample data (src/demo.ts). */
let demo = false;
export const setDemo = (on: boolean) => {
  demo = on;
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (demo) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { demoApi } = require("./demo") as typeof import("./demo");
    const method = init.method ?? (init.body === undefined ? "GET" : "POST");
    const result = await demoApi(method, path, init.body);
    if (result.status >= 400) throw new ApiError(result.status, (result.data as { error?: string })?.error ?? "Request failed");
    return result.data as T;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: {
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach Orvyn. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
