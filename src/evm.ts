/**
 * Calls on BNB Chain sent by the person's embedded wallet (Privy's EIP-1193 provider). The Orvyn
 * API builds every call (payments, escrow actions); the wallet only signs and sends them, in
 * order, each confirmed before the next (so an approval lands before the call that uses it).
 */
export interface UnsignedCall {
  to: string;
  data: string;
  /** Wei, decimal string. */
  value: string;
}

/** An EIP-1193 provider (what Privy's embedded wallet exposes). */
export interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

const BSC_CHAIN_ID = "0x38";

export function walletError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient funds|exceeds balance/i.test(message)) return new Error("Your wallet doesn't have enough BNB for this (it also pays network fees).");
  if (/reject|cancel|denied/i.test(message)) return new Error("Cancelled.");
  return error instanceof Error ? error : new Error(message);
}

async function waitForReceipt(provider: Eip1193, hash: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = (await provider.request({ method: "eth_getTransactionReceipt", params: [hash] }).catch(() => null)) as { status?: string } | null;
    if (receipt?.status) {
      if (receipt.status !== "0x1") throw new Error(`The transaction failed on chain (${hash}).`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Still waiting for ${hash} to confirm.`);
}

/** Send calls in order from `from`, each confirmed by the person. Resolves to their hashes. */
export async function sendCalls(provider: Eip1193, from: string, calls: UnsignedCall[]) {
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] }).catch(() => undefined);
  const hashes: string[] = [];
  for (const call of calls) {
    try {
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: call.to,
            ...(call.data && call.data !== "0x" ? { data: call.data } : {}),
            value: `0x${BigInt(call.value || "0").toString(16)}`,
            chainId: BSC_CHAIN_ID,
          },
        ],
      })) as string;
      await waitForReceipt(provider, hash);
      hashes.push(hash);
    } catch (error) {
      throw walletError(error);
    }
  }
  return hashes;
}
