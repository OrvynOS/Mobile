/**
 * Privy in Orvyn Mobile: email / X / Google sign-in and the embedded EVM wallet the person gets
 * on first sign-in (they hold it; Orvyn can't sign with it). Only loaded when Privy is configured
 * (EXPO_PUBLIC_PRIVY_APP_ID), so the demo still runs in Expo Go.
 *
 * <PrivyRoot> wraps the app (provider + Privy's UI elements); <PrivyBridge> reads Privy's hooks and
 * hands the session what it needs: sign in, the identity token, the wallet's EIP-1193 provider.
 */
import { useEffect, type ReactNode } from "react";
import { PrivyProvider, useEmbeddedEthereumWallet, useIdentityToken, usePrivy } from "@privy-io/expo";
import { PrivyElements, useLogin } from "@privy-io/expo/ui";
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from "./config";
import { scheme } from "./theme";
import type { Eip1193 } from "./evm";

export interface PrivyHandle {
  ready: boolean;
  /** The embedded wallet's address (lowercase), once it exists. */
  address: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  identityToken: () => Promise<string | null>;
  provider: () => Promise<Eip1193>;
}

export function PrivyRoot({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID || undefined} config={{ embedded: { ethereum: { createOnLogin: "users-without-wallets" } } }}>
      {children}
      <PrivyElements config={{ appearance: { colorScheme: scheme, accentColor: scheme === "light" ? "#0A6FC2" : "#8BC8FF" } } as never} />
    </PrivyProvider>
  );
}

export function PrivyBridge({ onChange }: { onChange: (handle: PrivyHandle) => void }) {
  const { isReady, user, logout } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const { getIdentityToken } = useIdentityToken();
  const { login } = useLogin();
  const wallet = wallets[0] ?? null;

  useEffect(() => {
    onChange({
      ready: isReady,
      address: wallet?.address?.toLowerCase() ?? null,
      login: async () => {
        if (!user) await login({ loginMethods: ["email", "twitter", "google"] });
        if (!wallet) await create().catch(() => undefined);
      },
      logout,
      identityToken: getIdentityToken,
      provider: async () => {
        if (!wallet) throw new Error("Your Orvyn wallet isn't ready yet. Try again in a moment.");
        return (await wallet.getProvider()) as unknown as Eip1193;
      },
    });
  }, [isReady, user?.id, wallet?.address]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
