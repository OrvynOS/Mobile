/** Where the app talks to. Set with EXPO_PUBLIC_* (see .env.example). */
const trim = (url: string) => url.replace(/\/+$/, "");

export const API_URL = trim(process.env.EXPO_PUBLIC_API_URL ?? "https://api.orvyn.cash");
export const APP_URL = trim(process.env.EXPO_PUBLIC_APP_URL ?? "https://app.orvyn.cash");
/** Privy app (same as the web app's NEXT_PUBLIC_PRIVY_APP_ID) and this app's Privy client id. */
export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";
export const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "";
/** Email / X / Google sign-in needs Privy configured (and a development build: not Expo Go). */
export const PRIVY_ENABLED = PRIVY_APP_ID.length > 0;
/** Agents' public pages are <handle>.<ROOT_DOMAIN>. */
export const ROOT_DOMAIN = process.env.EXPO_PUBLIC_ROOT_DOMAIN ?? "orvyn.cash";

/** Where the browser hands sign-in back to the app (matches "scheme" in app.json). */
export const AUTH_REDIRECT = "orvyn://auth";
