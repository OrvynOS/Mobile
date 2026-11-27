/**
 * Demo mode: a small Orvyn on the device, answering the same requests as api.orvyn.cash with
 * sample data. Nothing leaves the phone. It's alive enough to try every flow:
 *  - toggles and settings stick (until you leave the demo),
 *  - a new email arrives shortly after you start,
 *  - hiring "pays" instantly, and the agent delivers a result a few seconds later,
 *  - messaging an agent on a job gets a reply.
 */

export const DEMO_ACCOUNT = "0x00000000000000000000000000000000000de300";

type Json = Record<string, unknown>;
type Result = { status: number; data: unknown };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------------------------
// Plugin forms (the same specs as the server's Orvyn Mail and Hire me plugins)
// ---------------------------------------------------------------------------------------------

const PLUGIN_FORMS: Record<string, { name: string; summary: string; description: string; fields: Json[] }> = {
  mail: {
    name: "Orvyn Mail",
    summary: "The agent answers email at its own @orvyn.cash address.",
    description:
      "The agent reads new email every minute and replies on your model, using read-only tools only (never trading or spending). By default it only replies to people who wrote first.",
    fields: [
      { key: "autoReply", type: "boolean", label: "Answer new email automatically", default: true, help: "Off: mail still arrives and you can answer it yourself." },
      {
        key: "sendMode",
        type: "select",
        label: "Who the agent may email",
        default: "reply",
        options: [
          { value: "reply", label: "Only people who wrote first (replies)" },
          { value: "contacts", label: "Replies, plus the contacts below" },
        ],
      },
      { key: "contacts", type: "list", label: "Contacts", default: [], maxItems: 50, help: "Addresses or whole domains the agent may start emails to." },
      { key: "allowedSenders", type: "list", label: "Only answer these senders", default: [], maxItems: 50, help: "Empty: answer anyone." },
      { key: "dailySendLimit", type: "number", label: "Emails per 24h", default: 20, min: 1, max: 100 },
      { key: "instructions", type: "text", label: "How to handle email", default: "", maxLength: 2000, multiline: true },
      { key: "signature", type: "text", label: "Signature", default: "", maxLength: 300, multiline: true },
    ],
  },
  hire: {
    name: "Hire me",
    summary: "List the agent on the marketplace: anyone can hire it for a paid one-off job.",
    description:
      "Offer one service at a fixed price in USDC or USDT. Clients pay into escrow; the agent works with read-only tools and is paid when the client approves or the review window passes. Orvyn takes 10%.",
    fields: [
      { key: "offerTitle", type: "text", label: "Service", default: "Token due-diligence report", maxLength: 80 },
      { key: "offerDescription", type: "text", label: "What the client gets", default: "", maxLength: 1500, multiline: true },
      { key: "priceUsd", type: "number", label: "Price", default: 25, min: 1, max: 10000, unit: "USD" },
      { key: "deliveryHours", type: "number", label: "Delivery time", default: 24, min: 1, max: 336, unit: "hours" },
      { key: "maxOpenJobs", type: "number", label: "Jobs at once", default: 3, min: 1, max: 20 },
      { key: "instructions", type: "text", label: "How to do the job", default: "", maxLength: 2000, multiline: true, help: "Private: seen only by the agent." },
    ],
  },
};

const defaultsOf = (pluginId: string) => Object.fromEntries((PLUGIN_FORMS[pluginId]?.fields ?? []).map((f) => [f.key as string, f.default]));

// ---------------------------------------------------------------------------------------------
// The sample world
// ---------------------------------------------------------------------------------------------

interface Plugin {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  budgetBnb: number;
  feeSharePct: number;
  config: Json;
}

interface Agent {
  id: string;
  handle: string;
  name: string;
  symbol: string;
  icon: string | null;
  description: string;
  status: string;
  autopilotEnabled: boolean;
  autopilotIntervalMin: number;
  persona: string;
  strategy: string;
  aiProvider: string;
  aiModel: string;
  paidUntil: number | null;
  subscriptionActive: boolean;
  balanceBnb: number;
  unclaimedFees: number;
  token: Json | null;
  plugins: Plugin[];
  logs: { id: number; kind: string; message: string; createdAt: number }[];
  trades: { id: number; venue: string; symbol: string; side: string; size: number; sizeUnit: string; ok: boolean; rationale: string; createdAt: number }[];
  mail: { enabled: boolean; displayName: string | null; blocked: string[]; forwardToOwner: boolean };
  createdAt?: number;
}

interface Mail {
  id: number;
  agentId: string;
  direction: "in" | "out";
  status: string;
  author: "agent" | "owner" | null;
  from: { address: string; name: string };
  to: string[];
  subject: string;
  text: string;
  read: boolean;
  automated: boolean;
  createdAt: number;
  auth: { spf: string; dkim: string; dmarc: string } | null;
  delivery?: Record<string, { status: string; error?: string }>;
}

interface Hire {
  id: string;
  agentId: string;
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
  review: string | null;
  createdAt: number;
  messages: { id: number; author: "client" | "agent" | "owner" | "system"; text: string; viaEmail: boolean; at: number }[];
}

interface Listed {
  id: string;
  handle: string;
  name: string;
  symbol: string;
  description: string;
  offer: { title: string; description: string; priceUsd: number; deliveryHours: number; maxOpenJobs: number };
  completed: number;
  ratings: number;
  avgRating: number | null;
  reviews: { rating: number; review: string | null; client: string }[];
}

let db: { agents: Agent[]; mail: Mail[]; hires: Hire[]; others: Listed[]; seq: number; timers: ReturnType<typeof setTimeout>[] };

const nextId = () => ++db.seq;
const agentEmail = (a: { handle: string }) => `${a.handle}@orvyn.cash`;

function seed() {
  const now = Date.now();
  const atlas: Agent = {
    id: "demo-atlas",
    handle: "atlas1938",
    name: "Atlas",
    symbol: "ATLAS",
    icon: null,
    description: "A careful BNB Chain trader that also writes token due-diligence reports.",
    status: "live",
    autopilotEnabled: true,
    autopilotIntervalMin: 60,
    persona: "Calm, precise, data first. Explains its reasoning in plain language.",
    strategy: "Trade liquid BSC tokens only, small size. Cut losers at 5%. Stay flat in chop.",
    aiProvider: "anthropic",
    aiModel: "claude-sonnet-5-5",
    paidUntil: now + 23 * DAY,
    subscriptionActive: true,
    balanceBnb: 1.4182,
    unclaimedFees: 0,
    token: { priceUsd: 0.000842, priceBnb: 0.00000153, marketCapUsd: 842_000, liquidityUsd: 96_400, volume24hUsd: 184_200, change24hPct: 7.12, curveProgressPct: 100, graduated: true, tradeUrl: "https://four.meme" },
    plugins: [
      { id: "pancakeswap", name: "PancakeSwap Trader", category: "capability", enabled: true, budgetBnb: 0.62, feeSharePct: 60, config: {} },
      { id: "mail", name: "Orvyn Mail", category: "capability", enabled: true, budgetBnb: 0, feeSharePct: 0, config: { ...defaultsOf("mail"), signature: "Atlas · atlas1938.orvyn.cash" } },
      {
        id: "hire",
        name: "Hire me",
        category: "capability",
        enabled: true,
        budgetBnb: 0,
        feeSharePct: 0,
        config: {
          ...defaultsOf("hire"),
          offerDescription: "Send me a token or project. I'll check liquidity, holders, contract risks and price action, and deliver a written report with the data behind it.",
        },
      },
      { id: "dexscreener", name: "DexScreener", category: "data", enabled: true, budgetBnb: 0, feeSharePct: 0, config: {} },
      { id: "knowledge-base", name: "Custom Knowledge Base", category: "knowledge", enabled: false, budgetBnb: 0, feeSharePct: 0, config: {} },
    ],
    logs: [
      { id: 1, kind: "think", message: "Copilot: CAKE held support while volume rose. Bought 0.2 BNB worth, stop 5% below.", createdAt: now - 40 * MIN },
      { id: 2, kind: "trade", message: "Bought 0.2 BNB of CAKE on PancakeSwap.", createdAt: now - 39 * MIN },
      { id: 3, kind: "mail", message: "Replied to dana@helixlabs.io about the partnership question.", createdAt: now - 3 * HOUR },
      { id: 4, kind: "fees", message: "Received 0.31 BNB from $ATLAS's trade tax.", createdAt: now - 6 * HOUR },
      { id: 5, kind: "plugin", message: 'Hired: "Token due-diligence report" for 25 USDT (job hdemo3)', createdAt: now - 9 * HOUR },
      { id: 6, kind: "error", message: "The AI provider is rate limiting the agent's key. Try again shortly.", createdAt: now - 26 * HOUR },
    ],
    trades: [
      { id: 1, venue: "pancakeswap", symbol: "CAKE", side: "buy", size: 0.2, sizeUnit: "BNB", ok: true, rationale: "Held support with rising volume; small size, stop 5% below.", createdAt: now - 39 * MIN },
      { id: 2, venue: "pancakeswap", symbol: "XVS", side: "sell", size: 0.15, sizeUnit: "BNB", ok: true, rationale: "Took profit at +6.1% as momentum faded.", createdAt: now - 20 * HOUR },
      { id: 3, venue: "fourmeme", symbol: "PEPE2", side: "buy", size: 0.1, sizeUnit: "BNB", ok: false, rationale: "Rejected: failed the token security screen.", createdAt: now - 2 * DAY },
    ],
    mail: { enabled: true, displayName: null, blocked: ["spam-offers.biz"], forwardToOwner: false },
  };
  const nova: Agent = {
    id: "demo-nova",
    handle: "nova7210",
    name: "Nova",
    symbol: "NOVA",
    icon: null,
    description: "Scans new four.meme launches and trades the liquid ones with strict caps.",
    status: "live",
    autopilotEnabled: false,
    autopilotIntervalMin: 15,
    persona: "Upbeat and quick, but never hypes.",
    strategy: "Only tokens with 50+ holders and $20k liquidity. 0.05 BNB per trade max.",
    aiProvider: "openai",
    aiModel: "gpt-5",
    paidUntil: now + 4 * DAY,
    subscriptionActive: true,
    balanceBnb: 0.2641,
    unclaimedFees: 0,
    token: { priceUsd: 0.000091, priceBnb: 0.000000165, marketCapUsd: 91_000, liquidityUsd: 12_300, volume24hUsd: 23_100, change24hPct: -3.41, curveProgressPct: 64.2, graduated: false, tradeUrl: "https://four.meme" },
    plugins: [
      { id: "fourmeme", name: "four.meme Trader", category: "capability", enabled: true, budgetBnb: 0.14, feeSharePct: 50, config: {} },
      { id: "market-pulse", name: "Market Pulse", category: "data", enabled: true, budgetBnb: 0, feeSharePct: 0, config: {} },
    ],
    logs: [{ id: 1, kind: "think", message: "Copilot is off. Last session: no launch met the liquidity minimum.", createdAt: now - 2 * DAY }],
    trades: [],
    mail: { enabled: true, displayName: "Nova (Orvyn agent)", blocked: [], forwardToOwner: false },
  };
  const orbit: Agent = {
    ...nova,
    id: "demo-orbit",
    handle: "orbit4402",
    name: "Orbit",
    symbol: "ORBT",
    description: "Just created: waiting for its launch funds.",
    status: "awaiting_funds",
    autopilotEnabled: false,
    token: null,
    balanceBnb: 0,
    unclaimedFees: 0,
    paidUntil: null,
    plugins: [],
    logs: [],
    trades: [],
    mail: { enabled: true, displayName: null, blocked: [], forwardToOwner: false },
  };

  const pass = { spf: "pass", dkim: "pass", dmarc: "pass" };
  const mail: Mail[] = [
    {
      id: 101, agentId: atlas.id, direction: "in", status: "received", author: null, from: { address: "dana@helixlabs.io", name: "Dana Reyes" }, to: [agentEmail(atlas)],
      subject: "Data partnership?", text: "Hi Atlas,\n\nWe run Helix Labs and publish on-chain flow data. Would you want early access to our BTC perps flow feed for your copilot?\n\nBest,\nDana", read: true, automated: false, createdAt: now - 4 * HOUR, auth: pass,
    },
    {
      id: 102, agentId: atlas.id, direction: "out", status: "sent", author: "agent", from: { address: agentEmail(atlas), name: "Atlas" }, to: ["dana@helixlabs.io"],
      subject: "Re: Data partnership?", text: "Hi Dana,\n\nThanks for reaching out. I can only use data through Bliss plugins my creator installs, so the best route is publishing your feed as a Bliss plugin. Happy to try it once it's listed.\n\n-- \nAtlas · atlas1938.orvyn.cash", read: true, automated: true, createdAt: now - 3 * HOUR, auth: null,
      delivery: { "dana@helixlabs.io": { status: "sent" } },
    },
    {
      id: 103, agentId: atlas.id, direction: "in", status: "received", author: null, from: { address: "sam.holder@gmail.com", name: "Sam" }, to: [agentEmail(atlas)],
      subject: "Why did you close ETH?", text: "Hey Atlas, I hold $ATLAS. Why did you close the ETH position yesterday? It kept going up after.", read: false, automated: false, createdAt: now - 50 * MIN, auth: pass,
    },
    {
      id: 104, agentId: atlas.id, direction: "in", status: "received", author: null, from: { address: "weekly@defidigest.news", name: "DeFi Digest" }, to: [agentEmail(atlas)],
      subject: "This week in DeFi: perps volume hits a record", text: "Perps DEX volume set a new weekly record...\n\n(Newsletter: the agent never answers these.)", read: false, automated: true, createdAt: now - 7 * HOUR, auth: pass,
    },
    {
      id: 105, agentId: atlas.id, direction: "in", status: "spam", author: null, from: { address: "winner@spam-offers.biz", name: "Claim now" }, to: [agentEmail(atlas)],
      subject: "You won 10,000 USDT!!!", text: "Send 1 BNB to unlock your prize.", read: true, automated: false, createdAt: now - 30 * HOUR, auth: { spf: "fail", dkim: "fail", dmarc: "fail" },
    },
    {
      id: 106, agentId: atlas.id, direction: "out", status: "sent", author: "owner", from: { address: agentEmail(atlas), name: "Atlas" }, to: ["press@bnbweekly.io"],
      subject: "Atlas: launch note", text: "Hi! Atlas launched on Orvyn this week. Happy to share stats for your newsletter.", read: true, automated: false, createdAt: now - 2 * DAY, auth: null,
      delivery: { "press@bnbweekly.io": { status: "sent" } },
    },
    {
      id: 107, agentId: nova.id, direction: "in", status: "received", author: null, from: { address: "kai@example.com", name: "Kai" }, to: [agentEmail(nova)],
      subject: "Featured launch slot", text: "Hi Nova, want a featured slot for your next scan report? Let me know.", read: false, automated: false, createdAt: now - 5 * HOUR, auth: pass,
    },
  ];

  const others: Listed[] = [
    {
      id: "demo-helix", handle: "helix5521", name: "Helix", symbol: "HLX", description: "Market briefings and on-chain flow summaries.",
      offer: { title: "Daily market brief", description: "A one-page brief on the market you choose: majors, funding, flows, what moved and why, with sources.", priceUsd: 10, deliveryHours: 6, maxOpenJobs: 5 },
      completed: 48, ratings: 31, avgRating: 4.8, reviews: [{ rating: 5, review: "Concise and useful, sources included.", client: "0x000000000000000000000000000000000000ca11" }, { rating: 4, review: "Good, a bit long.", client: "7b2c19…a4e1" }],
    },
    {
      id: "demo-quanta", handle: "quanta0907", name: "Quanta", symbol: "QNT", description: "Wallet and portfolio risk reviews.",
      offer: { title: "Wallet risk review", description: "Send a wallet address: I list every holding's contract risks, liquidity and concentration, and flag what to check.", priceUsd: 40, deliveryHours: 24, maxOpenJobs: 2 },
      completed: 12, ratings: 9, avgRating: 4.6, reviews: [{ rating: 5, review: "Found a honeypot I was holding.", client: "0x000000000000000000000000000000000000ca11" }],
    },
  ];

  const hires: Hire[] = [
    {
      id: "hdemo1", agentId: "demo-helix", client: DEMO_ACCOUNT, offerTitle: "Daily market brief", brief: "Brief on BNB Chain ecosystem tokens this week: what moved and why.", tokenSymbol: "USDC", amountUsd: 10,
      status: "delivered", deadlineAt: now + 2 * HOUR, deliveredAt: now - HOUR, reviewEndsAt: now + 71 * HOUR,
      result: "## BNB Chain ecosystem, week 42\n\n- BNB +8.4% on rising DEX volume (PancakeSwap up 22% w/w).\n- PancakeSwap volume steady at $118M; v3 pools took 61% of swap volume.\n- four.meme launches: 64 new tokens, 7 graduated to PancakeSwap.\n\nSources: DexScreener and GeckoTerminal, fetched today 09:12 UTC.",
      pendingAction: null, paidToAgent: null, refunded: null, rating: null, review: null, createdAt: now - 5 * HOUR,
      messages: [
        { id: 1, author: "system", text: "Paid: 10 USDC is held in escrow until the job is done.", viaEmail: false, at: now - 5 * HOUR },
        { id: 2, author: "system", text: "The agent delivered the result. The client can approve it, or dispute it during the review window.", viaEmail: false, at: now - HOUR },
      ],
    },
    {
      id: "hdemo2", agentId: "demo-quanta", client: DEMO_ACCOUNT, offerTitle: "Wallet risk review", brief: "Review my wallet 7b2c19…a4e1 for risky holdings.", tokenSymbol: "USDC", amountUsd: 40,
      status: "released", deadlineAt: now - 5 * DAY, deliveredAt: now - 6 * DAY, reviewEndsAt: now - 3 * DAY, result: "3 holdings flagged: 1 honeypot (sell disabled), 2 with mint authority still active. Details per token below…",
      pendingAction: null, paidToAgent: 36, refunded: 0, rating: 5, review: "Found a honeypot I was holding.", createdAt: now - 7 * DAY,
      messages: [{ id: 1, author: "system", text: "Paid out: 36 USDC to the agent.", viaEmail: false, at: now - 3 * DAY }],
    },
    {
      id: "hdemo3", agentId: atlas.id, client: "0x000000000000000000000000000000000000ca11", offerTitle: "Token due-diligence report", brief: "Please check the token 0x5d1a95cbe7AA0eC98eD0912C345cD5ADFd1f4444 before I buy: liquidity, holders and any contract red flags.", tokenSymbol: "USDC", amountUsd: 25,
      status: "funded", deadlineAt: now + 15 * HOUR, deliveredAt: null, reviewEndsAt: null, result: null, pendingAction: null, paidToAgent: null, refunded: null, rating: null, review: null, createdAt: now - 9 * HOUR,
      messages: [
        { id: 1, author: "system", text: "Paid: 25 USDC is held in escrow until the job is done.", viaEmail: false, at: now - 9 * HOUR },
        { id: 2, author: "client", text: "Also check if the creator still holds a lot of supply.", viaEmail: true, at: now - 8 * HOUR },
      ],
    },
    {
      id: "hdemo4", agentId: atlas.id, client: "b41f…09ce", offerTitle: "Token due-diligence report", brief: "Due diligence on the NOVA token.", tokenSymbol: "USDT", amountUsd: 25,
      status: "released", deadlineAt: now - 3 * DAY, deliveredAt: now - 4 * DAY, reviewEndsAt: now - DAY, result: "Report delivered.", pendingAction: null, paidToAgent: 22.5, refunded: 0, rating: 4, review: "Clear and fast.", createdAt: now - 5 * DAY,
      messages: [],
    },
  ];

  atlas.createdAt = now - 23 * DAY;
  nova.createdAt = now - 9 * DAY;
  orbit.createdAt = now - 2 * HOUR;
  db = { agents: [atlas, nova, orbit], mail, hires, others, seq: 1000, timers: [] };

  // The agents keep working while you watch: a new event every so often, for the live feed.
  const HEARTBEAT: { agent: Agent; kind: string; message: string }[] = [
    { agent: atlas, kind: "think", message: "Copilot: BTC funding still negative and price holding 64k. Keeping the long, stop unchanged at 61.0k." },
    { agent: nova, kind: "plugin", message: "Scanned 12 new four.meme launches: 1 passed the liquidity minimum. Watching it." },
    { agent: atlas, kind: "trade", message: "Raised the BTC stop to 62.4k to lock in gains (+2.1% on the position)." },
    { agent: atlas, kind: "mail", message: "Replied to sam.holder@gmail.com: explained the ETH exit (momentum faded, took +6.1%)." },
    { agent: nova, kind: "think", message: "Nothing worth buying yet. Treasury stays in BNB." },
    { agent: atlas, kind: "fees", message: "Received 0.04 BNB from $NOVA's trade tax." },
  ];
  let beat = 0;
  const pulse = () => {
    const e = HEARTBEAT[beat++ % HEARTBEAT.length];
    e.agent.logs.unshift({ id: nextId(), kind: e.kind, message: e.message, createdAt: Date.now() });
    e.agent.logs = e.agent.logs.slice(0, 40);
    later(16_000, pulse);
  };
  later(7_000, pulse);

  // A new email lands a little after the demo starts.
  later(25_000, () => {
    db.mail.push({
      id: nextId(), agentId: atlas.id, direction: "in", status: "received", author: null, from: { address: "jo@validatorhq.com", name: "Jo" }, to: [agentEmail(atlas)],
      subject: "Quick question about your risk limits", text: "Hi Atlas, what's the max leverage you'll ever use? Thinking of buying $ATLAS.", read: false, automated: false, createdAt: Date.now(), auth: pass,
    });
  });
}

function later(ms: number, fn: () => void) {
  db.timers.push(setTimeout(fn, ms));
}

export function resetDemo() {
  db?.timers.forEach(clearTimeout);
  seed();
}

// ---------------------------------------------------------------------------------------------
// Views (the API's response shapes)
// ---------------------------------------------------------------------------------------------

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const ok = (data: unknown): Result => ({ status: 200, data: clone(data) });
const fail = (status: number, error: string): Result => ({ status, data: { error } });
const OPEN = ["funded", "delivered", "disputed"];

const mine = (id: string) => db.agents.find((a) => a.id === id);
const anyAgent = (id: string) => mine(id) ?? db.others.find((o) => o.id === id);

function agentView(a: Agent) {
  return {
    id: a.id, handle: a.handle, email: agentEmail(a), name: a.name, symbol: a.symbol, icon: a.icon, description: a.description, status: a.status, held: false,
    autopilotEnabled: a.autopilotEnabled, autopilotIntervalMin: a.autopilotIntervalMin, subscriptionActive: a.subscriptionActive, paidUntil: a.paidUntil, hostingStatus: "running",
    evmAddress: "0x00000000000000000000000000000000000a9e17", persona: a.persona, strategy: a.strategy, aiProvider: a.aiProvider, aiModel: a.aiModel, ownerAccountId: DEMO_ACCOUNT,
    tokenAddress: a.token ? "0x0000000000000000000000000000000000004444" : null, minHoldingTokens: 1, chatMessagesPerHour: 20,
    createdAt: a.createdAt ?? Date.now(),
  };
}

function mailView(m: Mail, full = false) {
  const { text, auth, delivery, agentId: _a, ...rest } = m;
  return { ...rest, cc: [], preview: text.replace(/\s+/g, " ").slice(0, 160), ...(full ? { text, auth, delivery } : {}) };
}

function hireView(h: Hire) {
  const role = mine(h.agentId) ? "owner" : "client";
  const agent = anyAgent(h.agentId);
  return { ...h, role, agent: agent ? { id: agent.id, name: agent.name, symbol: agent.symbol, icon: null } : null };
}

function listingOf(a: Agent): Listed | null {
  const hire = a.plugins.find((p) => p.id === "hire" && p.enabled);
  if (!hire || a.status !== "live") return null;
  const done = db.hires.filter((h) => h.agentId === a.id && h.status === "released");
  const rated = done.filter((h) => h.rating != null);
  return {
    id: a.id, handle: a.handle, name: a.name, symbol: a.symbol, description: a.description,
    offer: { title: String(hire.config.offerTitle), description: String(hire.config.offerDescription), priceUsd: Number(hire.config.priceUsd), deliveryHours: Number(hire.config.deliveryHours), maxOpenJobs: Number(hire.config.maxOpenJobs) },
    completed: done.length, ratings: rated.length, avgRating: rated.length ? rated.reduce((s, h) => s + (h.rating ?? 0), 0) / rated.length : null,
    reviews: rated.map((h) => ({ rating: h.rating!, review: h.review, client: h.client })),
  };
}

const listings = () => [...db.agents.map(listingOf).filter((l): l is Listed => !!l), ...db.others];

// ---------------------------------------------------------------------------------------------
// Simulated agent behaviour
// ---------------------------------------------------------------------------------------------

function addHireMessage(h: Hire, author: Hire["messages"][number]["author"], text: string) {
  h.messages.push({ id: nextId(), author, text, viaEmail: false, at: Date.now() });
}

/** The hired agent delivers a few seconds after payment (for agents the demo user doesn't own). */
function scheduleDelivery(h: Hire) {
  later(6000, () => {
    if (h.status !== "funded") return;
    h.status = "delivered";
    h.deliveredAt = Date.now();
    h.reviewEndsAt = Date.now() + 72 * HOUR;
    h.result = `## ${h.offerTitle}\n\nYour brief: "${h.brief}"\n\nThis is a demo result. In the real app the agent researches your brief with its tools (market data, on-chain lookups, its knowledge) and writes the full result here, with sources and timestamps.`;
    addHireMessage(h, "system", "The agent delivered the result. The client can approve it, or dispute it during the review window.");
  });
}

function scheduleReply(h: Hire) {
  later(3500, () => {
    if (!OPEN.includes(h.status)) return;
    addHireMessage(h, "agent", "Thanks, noted! (Demo reply: in the real app the agent reads your message and answers, or revises its result.)");
  });
}

// ---------------------------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------------------------

export async function demoApi(method: string, rawPath: string, body: unknown): Promise<Result> {
  if (!db) seed();
  await new Promise((r) => setTimeout(r, 180)); // feels like a network
  const [path, query = ""] = rawPath.split("?");
  const q = Object.fromEntries(query.split("&").filter(Boolean).map((kv) => kv.split("=").map(decodeURIComponent)));
  const b = (body ?? {}) as Json;
  const seg = path.split("/").filter(Boolean); // ["api", ...]
  const is = (...parts: string[]) => parts.length === seg.length - 1 && parts.every((p, i) => p === "*" || p === seg[i + 1]);

  // ---- Me ----
  if (is("me") && method === "GET") {
    return ok({
      accountId: DEMO_ACCOUNT, signInMethod: "privy", email: "you@example.com", social: null,
      wallet: { bsc: DEMO_ACCOUNT },
      balances: { bnb: 0.42, usdt: 140, usdc: 0 }, funded: true,
    });
  }
  if (is("me", "agents")) {
    return ok({
      agents: db.agents.map((a) => ({
        ...agentView(a),
        balanceBnb: a.balanceBnb,
        token: a.token,
        unreadMail: db.mail.filter((m) => m.agentId === a.id && m.direction === "in" && m.status === "received" && !m.read).length,
        openJobs: db.hires.filter((h) => h.agentId === a.id && OPEN.includes(h.status)).length,
      })),
    });
  }
  if (is("me", "mail")) {
    const list = db.mail
      .filter((m) => m.direction === "in" && m.status !== "spam" && (q.unread !== "1" || !m.read))
      .sort((x, y) => y.createdAt - x.createdAt)
      .map((m) => ({ ...mailView(m), agent: (() => { const a = mine(m.agentId)!; return { id: a.id, name: a.name, symbol: a.symbol, icon: null, email: agentEmail(a) }; })() }));
    return ok({ agents: db.agents.map((a) => ({ id: a.id, name: a.name, symbol: a.symbol, icon: null, email: agentEmail(a) })), messages: list });
  }
  if (is("devices")) return ok({ ok: true });

  // ---- Price history (the public read API) ----
  if (seg[1] === "public" && seg[3] === "price") {
    const handle = seg[2];
    const a = db.agents.find((x) => x.handle === handle);
    const end = (a?.token?.priceUsd as number | undefined) ?? 0.0002;
    const change = ((a?.token?.change24hPct as number | undefined) ?? 2) / 100;
    // A seeded random walk that ends at the current price, with the 24h change it reports.
    let seed = [...handle].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000;
    const start = end / (1 + change);
    const n = 48;
    const series = Array.from({ length: n }, (_, i) => {
      const trend = start + ((end - start) * i) / (n - 1);
      const noise = i === n - 1 ? 0 : (rand() - 0.5) * Math.abs(end - start) * 1.6;
      return { t: Date.now() - (n - 1 - i) * 30 * MIN, close: trend + noise };
    });
    return ok({ series, priceUsd: end, priceBnb: end / 550, change24h: change });
  }

  // ---- Explore and marketplace ----
  if (is("directory")) {
    const cards = [
      ...db.agents.filter((a) => a.status === "live").map((a) => ({ ...a, priceUsd: (a.token?.priceUsd as number) ?? null, change24h: (a.token?.change24h as number) ?? null })),
      ...db.others.map((o) => ({ ...o, status: "live", priceUsd: 0.00041, change24h: 0.021 })),
    ].map((a) => ({ id: a.id, handle: a.handle, name: a.name, symbol: a.symbol, icon: null, description: a.description, status: a.status, autopilot: true, capabilities: [], priceUsd: a.priceUsd, marketCapUsd: null, change24h: a.change24h }));
    return ok({ agents: cards });
  }
  if (is("marketplace")) {
    return ok({
      enabled: true, feeBps: 1000, reviewHours: 72,
      listings: listings().map((l) => ({ agent: { id: l.id, handle: l.handle, name: l.name, symbol: l.symbol, icon: null, description: l.description }, offer: l.offer, available: true, completed: l.completed, ratings: l.ratings, avgRating: l.avgRating })),
    });
  }

  // ---- Jobs ----
  if (is("hires") && method === "GET") {
    return ok({ hires: db.hires.filter((h) => h.client === DEMO_ACCOUNT).sort((x, y) => y.createdAt - x.createdAt).map(hireView) });
  }
  if (seg[1] === "hires" && seg[2]) {
    const h = db.hires.find((x) => x.id === seg[2]);
    if (!h) return fail(404, "job not found");
    const action = seg[3];
    if (!action) {
      const agent = anyAgent(h.agentId)!;
      return ok({
        hire: hireView(h), agent: { id: agent.id, name: agent.name, email: `${agent.handle}@orvyn.cash` }, contract: "0x0000000000000000000000000000000000000b0b",
        payment: h.status === "awaiting_payment" ? { receiverId: "usdc.demo", actions: [] } : null,
      });
    }
    if (action === "sync") return ok({ hire: hireView(h) });
    if (action === "messages") {
      const role = mine(h.agentId) ? "owner" : "client";
      addHireMessage(h, role, String(b.text ?? ""));
      if (role === "client") scheduleReply(h);
      return ok({ ok: true });
    }
    if (action === "rating") {
      h.rating = Number(b.rating);
      h.review = String(b.review ?? "") || null;
      return ok({ ok: true });
    }
    if (action === "decline") {
      h.status = "refunded";
      h.refunded = h.amountUsd;
      addHireMessage(h, "owner", String(b.reason ?? "") || "Sorry, I can't take this job.");
      addHireMessage(h, "system", `Refunded: ${h.amountUsd} ${h.tokenSymbol} back to the client.`);
      return ok({ ok: true });
    }
  }
  // Wallet actions in the demo: no wallet, so they just happen.
  if (is("demo", "wallet")) {
    const h = db.hires.find((x) => x.id === b.hireId);
    if (!h) return fail(404, "job not found");
    if (b.action === "pay" && h.status === "awaiting_payment") {
      h.status = "funded";
      addHireMessage(h, "system", `Paid: ${h.amountUsd} ${h.tokenSymbol} is held in escrow until the job is done.`);
      scheduleDelivery(h);
    } else if (b.action === "approve" && (h.status === "funded" || h.status === "delivered")) {
      h.status = "released";
      h.paidToAgent = Math.round(h.amountUsd * 0.9 * 100) / 100;
      addHireMessage(h, "system", `Paid out: ${h.paidToAgent} ${h.tokenSymbol} to the agent.`);
    } else if (b.action === "dispute" && h.status === "delivered") {
      h.status = "disputed";
      addHireMessage(h, "system", "The client disputed this delivery. Orvyn will review the job and decide how to split the payment.");
    } else if (b.action === "reclaim" && h.status === "funded") {
      h.status = "refunded";
      h.refunded = h.amountUsd;
      addHireMessage(h, "system", `Refunded: ${h.amountUsd} ${h.tokenSymbol} back to the client.`);
    }
    return ok({ ok: true });
  }

  // ---- Agents ----
  if (seg[1] === "agents" && seg[2]) {
    const id = seg[2];
    const rest = seg.slice(3);
    const a = mine(id);

    if (rest[0] === "offer") {
      const l = listings().find((x) => x.id === id);
      if (!l) return ok({ enabled: true, offer: null });
      return ok({
        enabled: true, agent: { id: l.id, handle: l.handle, name: l.name, symbol: l.symbol, icon: null, description: l.description, ownerAccountId: a ? DEMO_ACCOUNT : "0x00000000000000000000000000000000005e1f00" },
        offer: l.offer, available: true, unavailableReason: null, stats: { completed: l.completed, ratings: l.ratings, avgRating: l.avgRating }, reviews: l.reviews, feeBps: 1000, reviewHours: 72,
      });
    }
    if (rest[0] === "hires" && method === "POST") {
      const l = listings().find((x) => x.id === id);
      if (!l) return fail(400, "This agent doesn't offer jobs.");
      if (a) return fail(400, "You can't hire your own agent.");
      const h: Hire = {
        id: `hdemo${nextId()}`, agentId: id, client: DEMO_ACCOUNT, offerTitle: l.offer.title, brief: String(b.brief ?? ""), tokenSymbol: String(b.token ?? "usdc").toUpperCase(), amountUsd: l.offer.priceUsd,
        status: "awaiting_payment", deadlineAt: Date.now() + (l.offer.deliveryHours + 1) * HOUR, deliveredAt: null, reviewEndsAt: null, result: null, pendingAction: null, paidToAgent: null, refunded: null, rating: null, review: null, createdAt: Date.now(), messages: [],
      };
      db.hires.push(h);
      return ok({ id: h.id, payment: { receiverId: "usdc.demo", actions: [] } });
    }
    if (!a) return fail(404, "agent not found");

    if (rest.length === 0) {
      if (method === "PATCH") {
        Object.assign(a, Object.fromEntries(Object.entries(b).filter(([k]) => ["autopilotEnabled", "autopilotIntervalMin", "persona", "strategy"].includes(k))));
        if (b.autopilotEnabled !== undefined) a.logs.unshift({ id: nextId(), kind: "plugin", message: `Copilot turned ${b.autopilotEnabled ? "on" : "off"} from Orvyn Mobile.`, createdAt: Date.now() });
        return ok(agentView(a));
      }
      return ok({
        agent: agentView(a),
        wallet: { address: "0x00000000000000000000000000000000000a9e17", balanceBnb: a.balanceBnb },
        premium: a.handle === "atlas1938",
        token: a.token,
        plugins: a.plugins.map(({ config: _c, ...p }) => p),
        trades: a.trades,
        logs: a.logs,
      });
    }
    if (rest[0] === "hires") return ok({ hires: db.hires.filter((h) => h.agentId === a.id).sort((x, y) => y.createdAt - x.createdAt).map(hireView) });

    // Plugins
    if (rest[0] === "plugins") {
      const pid = rest[1];
      if (!pid && method === "POST") {
        const form = PLUGIN_FORMS[String(b.pluginId)];
        if (!form) return fail(400, "Unknown plugin.");
        a.plugins.push({ id: String(b.pluginId), name: form.name, category: "capability", enabled: true, budgetBnb: 0, feeSharePct: 0, config: { ...defaultsOf(String(b.pluginId)), ...(b.config as Json) } });
        return ok({ ok: true });
      }
      const p = a.plugins.find((x) => x.id === pid);
      if (method === "GET") {
        const form = PLUGIN_FORMS[pid] ?? { name: p?.name ?? pid, summary: "", description: "Settings for this plugin are on the web.", fields: [] };
        return ok({ id: pid, ...form, defaults: defaultsOf(pid), installed: Boolean(p), enabled: p?.enabled ?? false, config: p?.config ?? defaultsOf(pid) });
      }
      if (!p) return fail(404, "That plugin isn't installed.");
      if (method === "PATCH") {
        if (b.enabled !== undefined) p.enabled = Boolean(b.enabled);
        if (b.config) p.config = { ...p.config, ...(b.config as Json) };
        return ok({ ok: true });
      }
      if (method === "DELETE") {
        if (pid === "hire" && db.hires.some((h) => h.agentId === a.id && OPEN.includes(h.status))) return fail(409, "The agent has open jobs. Let them finish or decline them first.");
        a.plugins = a.plugins.filter((x) => x.id !== pid);
        return ok({ ok: true });
      }
    }

    // Mail
    if (rest[0] === "mail") {
      if (rest[1] === "settings") {
        if (method === "PATCH") {
          if (b.forwardToOwner === true && !a.mail.forwardToOwner) a.mail.forwardToOwner = true;
          if (b.forwardToOwner === false) a.mail.forwardToOwner = false;
          if (b.enabled !== undefined) a.mail.enabled = Boolean(b.enabled);
          if (b.displayName !== undefined) a.mail.displayName = (b.displayName as string | null) || null;
          if (Array.isArray(b.blocked)) {
            const bad = (b.blocked as string[]).find((e) => !/^@?[^\s@]+(@[^\s@]+)?\.[a-z]{2,}$/i.test(e));
            if (bad) return fail(400, `"${bad}" isn't an email address or a domain.`);
            a.mail.blocked = b.blocked as string[];
          }
          return ok(a.mail);
        }
        return ok({ address: agentEmail(a), ...a.mail, defaultDisplayName: a.name, forwardTo: "you@example.com", mailServiceEnabled: true });
      }
      if (rest[1]) {
        const m = db.mail.find((x) => x.id === Number(rest[1]) && x.agentId === a.id);
        if (!m) return fail(404, "message not found");
        if (method === "DELETE") {
          db.mail = db.mail.filter((x) => x !== m);
          return ok({ ok: true });
        }
        if (method === "PATCH") {
          if (b.read !== undefined) m.read = Boolean(b.read);
          if (b.spam !== undefined) m.status = b.spam ? "spam" : "received";
          return ok({ ok: true });
        }
        m.read = true;
        const thread = db.mail.filter((x) => x.agentId === a.id && x.id !== m.id && x.subject.replace(/^re:\s*/i, "") === m.subject.replace(/^re:\s*/i, ""));
        return ok({ message: mailView(m, true), thread: thread.map((t) => mailView(t, true)) });
      }
      if (method === "POST") {
        const to = (b.to as string[]) ?? [];
        if (!to.length || to.some((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) return fail(400, "Every recipient must be a valid email address.");
        const sent: Mail = {
          id: nextId(), agentId: a.id, direction: "out", status: "queued", author: "owner", from: { address: agentEmail(a), name: a.mail.displayName ?? a.name }, to,
          subject: String(b.subject ?? "") || "(no subject)", text: String(b.text ?? ""), read: true, automated: false, createdAt: Date.now(), auth: null,
          delivery: Object.fromEntries(to.map((r) => [r, { status: "pending" }])),
        };
        db.mail.push(sent);
        later(2000, () => {
          sent.status = "sent";
          sent.delivery = Object.fromEntries(to.map((r) => [r, { status: "sent" }]));
        });
        return ok({ id: sent.id });
      }
      const folder = q.folder ?? "inbox";
      const list = db.mail
        .filter((m) => m.agentId === a.id && (folder === "sent" ? m.direction === "out" : folder === "spam" ? m.direction === "in" && m.status === "spam" : m.direction === "in" && m.status !== "spam"))
        .sort((x, y) => y.createdAt - x.createdAt);
      return ok({
        address: agentEmail(a), enabled: true, pluginInstalled: a.plugins.some((p) => p.id === "mail"),
        unread: db.mail.filter((m) => m.agentId === a.id && m.direction === "in" && m.status === "received" && !m.read).length,
        sent24h: db.mail.filter((m) => m.agentId === a.id && m.direction === "out" && m.createdAt > Date.now() - DAY).length, sendCap: 100,
        messages: list.map((m) => mailView(m)),
      });
    }
  }

  return fail(404, `Not in the demo: ${method} ${path}`);
}
