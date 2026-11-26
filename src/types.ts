/** The Orvyn API responses the app reads (mirrors crates/api; kept local so the app has no server deps). */

export interface MyAgent {
  id: string;
  handle: string | null;
  email: string | null;
  name: string;
  symbol: string;
  icon: string | null;
  description: string;
  status: string;
  held: boolean;
  autopilotEnabled: boolean;
  autopilotIntervalMin: number;
  subscriptionActive: boolean;
  paidUntil: number | null;
  hostingStatus: string;
  unreadMail: number;
  openJobs: number;
  evmAddress: string;
  balanceBnb?: number | null;
  agentIdName?: string | null;
  premium?: boolean;
}

export interface PriceSeries {
  series: { t: number; close: number }[];
  priceUsd: number | null;
  priceBnb: number | null;
  change24h: number | null;
}

export interface AgentDetails {
  agent: MyAgent & {
    persona: string;
    strategy: string;
    aiProvider: string;
    aiModel: string;
    ownerAccountId: string;
    tokenAddress: string | null;
    minHoldingTokens: number;
    chatMessagesPerHour: number;
  };
  premium: boolean;
  wallet: { address: string; balanceBnb: number | null };
  token: { priceUsd: number | null; priceBnb: number | null; marketCapUsd: number | null; liquidityUsd: number | null; volume24hUsd: number | null; change24hPct: number | null; curveProgressPct: number | null; graduated: boolean; tradeUrl: string } | null;
  plugins: { id: string; name: string; category: string; enabled: boolean; budgetBnb: number; feeSharePct: number }[];
  trades: { id: number; venue: string; symbol: string; side: string; size: number; sizeUnit: string; ok: boolean; rationale: string; createdAt: number }[];
  logs: { id: number; kind: string; message: string; createdAt: number }[];
}

export interface AgentCard {
  id: string;
  handle: string | null;
  name: string;
  symbol: string;
  icon: string | null;
  description: string;
  status: string;
  autopilot: boolean;
  capabilities: string[];
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
}

export interface MailMessage {
  id: number;
  direction: "in" | "out";
  status: string;
  author: "agent" | "owner" | null;
  from: { address: string; name: string };
  to: string[];
  cc: string[];
  subject: string;
  preview: string;
  read: boolean;
  automated: boolean;
  createdAt: number;
  text?: string;
  auth?: { spf: string; dkim: string; dmarc: string } | null;
  delivery?: Record<string, { status: string; error?: string }>;
}

export interface Mailbox {
  address: string | null;
  enabled: boolean;
  pluginInstalled: boolean;
  unread: number;
  messages: MailMessage[];
}

export interface Listing {
  agent: { id: string; handle: string | null; name: string; symbol: string; icon: string | null; description: string };
  offer: { title: string; description: string; priceUsd: number; deliveryHours: number; maxOpenJobs: number };
  available: boolean;
  completed: number;
  ratings: number;
  avgRating: number | null;
}

export interface Hire {
  id: string;
  agentId: string;
  role: "client" | "owner";
  client: string;
  offerTitle: string;
  brief: string;
  tokenSymbol: string;
  amountUsd: number;
  status: string;
  deadlineAt: number;
  deliveredAt: number | null;
  reviewEndsAt: number | null;
  result: string | null;
  pendingAction: string | null;
  paidToAgent: number | null;
  refunded: number | null;
  rating: number | null;
  createdAt: number;
  messages: { id: number; author: "client" | "agent" | "owner" | "system"; text: string; viaEmail: boolean; at: number }[];
  agent?: { id: string; name: string; symbol: string; icon: string | null } | null;
}

export type { UnsignedCall } from "./evm";

/** What the API returns for the wallet to send on BNB Chain. */
export interface CallPlan {
  chainId: number;
  calls: import("./evm").UnsignedCall[];
}

export interface Me {
  accountId: string;
  signInMethod: "privy" | "wallet";
  email: string | null;
  social: { provider: string; username: string | null } | null;
  wallet: { bsc: string };
  balances: { bnb: number | null; usdt: number | null; usdc: number | null };
  funded: boolean;
}
