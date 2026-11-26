/**
 * Who's signed in to Orvyn Mobile.
 *
 * - Email, X or Google: Privy's sign-in, in the app. On first sign-in Privy creates the person's
 *   embedded EVM wallet (BNB Chain). Privy's identity token is swapped for an Orvyn session
 *   (/api/auth/privy); the wallet then signs payments right here.
 * - Their own wallet (MetaMask, Binance Wallet…): the app opens app.orvyn.cash/mobile/connect in a
 *   browser tab, the person signs in there (SIWE), and a one-time code comes back (PKCE-protected)
 *   for an Orvyn session. Actions that need their wallet's signature open in the browser.
 * - Demo: sample data on the device (src/demo.ts), nothing sent anywhere.
 *
 * Privy's SDK is only loaded when it's configured (EXPO_PUBLIC_PRIVY_APP_ID), so the demo also
 * runs in Expo Go. The session token lives in the device's secure storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { ApiError, api, setApiToken, setDemo, setUnauthorizedHandler } from "./api";
import { base64url } from "./base64";
import { APP_URL, AUTH_REDIRECT, PRIVY_ENABLED } from "./config";
import { sendCalls, type UnsignedCall } from "./evm";
import type { PrivyHandle } from "./privy";
import { registerForPush, unregisterPush } from "./push";

type Method = "privy" | "wallet" | "demo";
interface Stored {
  token: string;
  accountId: string;
  method: Method;
}

interface SessionState {
  ready: boolean;
  accountId: string | null;
  method: Method | null;
  demo: boolean;
  busy: boolean;
  error: string | null;
  privyAvailable: boolean;
  signInWithPrivy: () => void;
  signInWithWallet: () => Promise<void>;
  startDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  /** The embedded wallet, sending calls in-app (Orvyn wallet only), or null. */
  wallet: () => { address: string; sendCalls: (calls: UnsignedCall[]) => Promise<string[]> } | null;
}

const KEY = "orvyn.session.v1";
const SessionContext = createContext<SessionState | null>(null);

/** Privy's hooks, read only when Privy is configured. */
function Bridge({ onChange }: { onChange: (h: PrivyHandle) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrivyBridge } = require("./privy") as typeof import("./privy");
  return <PrivyBridge onChange={onChange} />;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privy, setPrivy] = useState<PrivyHandle | null>(null);
  const waitingForPrivy = useRef(false);

  const save = useCallback(async (next: Stored | null) => {
    setDemo(next?.method === "demo");
    setApiToken(next?.token ?? null);
    setSession(next);
    if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(KEY);
  }, []);

  // Restore the session, and check it's still valid.
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Stored;
          setDemo(stored.method === "demo");
          setApiToken(stored.token);
          setSession(stored);
          // Signed out only if the API says the session is gone (not when offline).
          await api("/api/me").catch(async (e) => {
            if (e instanceof ApiError && e.status === 401) await save(null);
          });
        }
      } catch {
        await save(null);
      } finally {
        setReady(true);
      }
    })();
  }, [save]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      if (session?.method !== "demo") await unregisterPush().catch(() => undefined);
      if (session?.method === "privy") await privy?.logout().catch(() => undefined);
      await save(null);
    } finally {
      setBusy(false);
    }
  }, [save, session?.method, privy]);

  useEffect(() => {
    setUnauthorizedHandler(() => void save(null));
    return () => setUnauthorizedHandler(null);
  }, [save]);

  // Push notifications for whoever's really signed in.
  useEffect(() => {
    if (session && session.method !== "demo") registerForPush().catch((e) => console.warn("[push]", e));
  }, [session]);

  // Privy finished signing in and the wallet exists: swap its identity token for an Orvyn session.
  useEffect(() => {
    if (!waitingForPrivy.current || !privy?.address) return;
    waitingForPrivy.current = false;
    setBusy(true);
    privy
      .identityToken()
      .then((identityToken) => {
        if (!identityToken) throw new Error("Sign-in didn't complete. Try again.");
        return api<{ accountId: string; token: string }>("/api/auth/privy", { body: { identityToken } });
      })
      .then((r) => save({ token: r.token, accountId: r.accountId, method: "privy" }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }, [privy, save]);

  const signInWithPrivy = useCallback(() => {
    if (!PRIVY_ENABLED || !privy) {
      setError("Email and social sign-in isn't set up in this build (EXPO_PUBLIC_PRIVY_APP_ID). Try the demo instead.");
      return;
    }
    setError(null);
    waitingForPrivy.current = true;
    privy.login().catch((e: Error) => {
      waitingForPrivy.current = false;
      if (!/closed|cancel/i.test(e.message)) setError(e.message);
    });
  }, [privy]);

  const signInWithWallet = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      // PKCE: only this app instance can redeem the code that comes back.
      const verifier = base64url(Crypto.getRandomBytes(32));
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(verifier));
      const challenge = base64url(new Uint8Array(digest));
      const state = base64url(Crypto.getRandomBytes(16));
      const result = await WebBrowser.openAuthSessionAsync(`${APP_URL}/mobile/connect?challenge=${challenge}&state=${state}`, AUTH_REDIRECT);
      if (result.type !== "success") return;
      const params = Linking.parse(result.url).queryParams ?? {};
      if (params.state !== state || typeof params.code !== "string") throw new Error("Sign-in didn't complete. Try again.");
      const r = await api<{ accountId: string; token: string }>("/api/auth/mobile/token", { body: { code: params.code, codeVerifier: verifier } });
      await save({ token: r.token, accountId: r.accountId, method: "wallet" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [save]);

  const startDemo = useCallback(async () => {
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resetDemo, DEMO_ACCOUNT } = require("./demo") as typeof import("./demo");
    resetDemo();
    await save({ token: "demo", accountId: DEMO_ACCOUNT, method: "demo" });
  }, [save]);

  const wallet = useCallback(() => {
    if (session?.method !== "privy" || !privy?.address) return null;
    // Only send from the wallet that is this session's account.
    if (privy.address !== session.accountId.toLowerCase()) return null;
    const address = privy.address;
    return { address, sendCalls: async (calls: UnsignedCall[]) => sendCalls(await privy.provider(), address, calls) };
  }, [session, privy]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      accountId: session?.accountId ?? null,
      method: session?.method ?? null,
      demo: session?.method === "demo",
      busy,
      error,
      privyAvailable: PRIVY_ENABLED,
      signInWithPrivy,
      signInWithWallet,
      startDemo,
      signOut,
      wallet,
    }),
    [ready, session, busy, error, signInWithPrivy, signInWithWallet, startDemo, signOut, wallet],
  );
  return (
    <SessionContext.Provider value={value}>
      {PRIVY_ENABLED && <Bridge onChange={setPrivy} />}
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
