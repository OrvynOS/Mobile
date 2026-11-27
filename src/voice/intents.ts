/**
 * Voice commands: turn what someone said into an action, on the device (no AI call, no keys, works
 * offline and in the demo). Matching is forgiving: agents by name, handle or ticker; numbers in
 * digits or words; lots of ways to say the same thing.
 */

export interface AgentRef {
  id: string;
  name: string;
  symbol: string;
  handle: string | null;
}

export type Intent =
  | { type: "autopilot"; agent: AgentRef | null; on: boolean }
  | { type: "interval"; agent: AgentRef | null; minutes: number }
  | { type: "status"; agent: AgentRef | null }
  | { type: "balance" }
  | { type: "read_mail"; agent: AgentRef | null }
  | { type: "open"; screen: "inbox" | "mail" | "jobs" | "hire" | "wallet" | "home" | "logs" | "agent" | "explore"; agent: AgentRef | null }
  | { type: "hire"; target: string }
  | { type: "help" }
  | { type: "unknown"; heard: string };

const WORD_NUMBERS: Record<string, number> = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45, sixty: 60, ninety: 90,
};

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
const has = (text: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(text));

/** The agent named in the text: by name, handle, or ticker (spoken or spelled). */
export function findAgent(text: string, agents: AgentRef[]): AgentRef | null {
  const t = ` ${norm(text)} `;
  return (
    agents.find((a) => t.includes(` ${norm(a.name)} `)) ??
    agents.find((a) => a.handle && t.includes(` ${norm(a.handle)} `)) ??
    agents.find((a) => t.includes(` ${norm(a.symbol)} `)) ??
    // "at las", "a t l a s": spelled or split by the recogniser
    agents.find((a) => t.replace(/\s/g, "").includes(norm(a.name).replace(/\s/g, ""))) ??
    null
  );
}

/** "every 15 minutes", "every hour", "three hours", "half an hour" → minutes. */
export function findMinutes(text: string): number | null {
  const t = norm(text);
  if (/\bhalf (an )?hour\b/.test(t)) return 30;
  const m = /\b(\d+|[a-z-]+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/.exec(t);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]];
    if (n) return /^h/.test(m[2]) ? n * 60 : n;
  }
  if (/\bevery hour\b|\bhourly\b/.test(t)) return 60;
  return null;
}

export function parse(raw: string, agents: AgentRef[]): Intent {
  const text = norm(raw);
  if (!text) return { type: "unknown", heard: raw };
  const agent = findAgent(text, agents);

  if (has(text, "help", "commands") || /what can (you|i) (do|say)/.test(text)) return { type: "help" };

  // Copilot on/off: "turn on autopilot for atlas", "pause nova", "start atlas", "stop trading"
  const offWords = /\b(turn off|switch off|disable|stop|pause|halt|kill)\b/.test(text);
  const onWords = /\b(turn on|switch on|enable|start|resume|activate|unpause)\b/.test(text);
  const minutes = findMinutes(text);
  if (minutes && (has(text, "every", "interval", "run", "runs", "set", "change", "make") || has(text, "autopilot", "copilot"))) {
    return { type: "interval", agent, minutes: Math.min(180, Math.max(1, minutes)) };
  }
  if ((offWords || onWords) && (has(text, "autopilot", "copilot", "trading", "trade", "agent") || agent)) {
    return { type: "autopilot", agent, on: !offWords || /\bunpause\b/.test(text) };
  }

  // Money
  if (has(text, "balance", "treasury", "wallet", "money", "funds", "worth") && !has(text, "open", "show", "go")) {
    return agent ? { type: "status", agent } : { type: "balance" };
  }

  // Mail
  if (/\b(read|check|any|new|unread|latest)\b.*\b(mail|email|emails|inbox|messages)\b/.test(text) || /\b(mail|email|inbox)\b.*\b(read|check)\b/.test(text)) {
    return { type: "read_mail", agent };
  }

  // Hire
  const hire = /\bhire\s+(.+)$/.exec(text);
  if (hire) return { type: "hire", target: hire[1].replace(/^(an?|the)\s+/, "") };

  // Navigation
  if (/\b(open|show|go to|take me to|view)\b/.test(text) || text.split(" ").length <= 2) {
    if (has(text, "inbox", "mailbox") && agent) return { type: "open", screen: "inbox", agent };
    if (has(text, "mail", "email", "emails", "inbox")) return { type: "open", screen: agent ? "inbox" : "mail", agent };
    if (has(text, "logs", "log", "activity", "trades", "history")) return { type: "open", screen: "logs", agent };
    if (has(text, "jobs", "job")) return { type: "open", screen: "jobs", agent: null };
    if (has(text, "marketplace", "market", "hire")) return { type: "open", screen: "hire", agent: null };
    if (has(text, "wallet", "account")) return { type: "open", screen: "wallet", agent: null };
    if (has(text, "explore", "directory")) return { type: "open", screen: "explore", agent: null };
    if (has(text, "home", "dashboard")) return { type: "open", screen: "home", agent: null };
    if (agent) return { type: "open", screen: "agent", agent };
  }

  // Status: "how is atlas doing", "status", "report", "what's nova up to"
  if (has(text, "how", "status", "report", "doing", "update", "summary", "whats", "what") || agent) return { type: "status", agent };

  return { type: "unknown", heard: raw };
}

/** Things to try, shown as chips (and used as examples in "help"). */
export function suggestions(agents: AgentRef[]) {
  const a = agents.find((x) => x.name) ?? null;
  const b = agents[1] ?? a;
  const name = a?.name ?? "my agent";
  return [
    `How is ${name} doing?`,
    "What's my balance?",
    "Read my mail",
    `Set ${name} to every 15 minutes`,
    `Pause ${b?.name ?? name}`,
    `Turn in copilot for ${name}`,
    "Open my jobs",
  ];
}
