/**
 * Carry out a voice command through the same API the screens use, and say what happened.
 * Returns the reply to speak and show, and optionally a screen to open afterwards.
 */
import { api } from "../api";
import { num, pct } from "../format";
import type { AgentDetails, Listing, MailMessage, MyAgent, PriceSeries } from "../types";
import { parse, suggestions, type AgentRef, type Intent } from "./intents";

export interface Outcome {
  say: string;
  navigate?: string;
  intent: Intent["type"];
}

const minutesLabel = (m: number) => (m % 60 === 0 ? `${m / 60 === 1 ? "every hour" : `every ${m / 60} hours`}` : `every ${m} minutes`);

/** The agent a command is about: the one named, or the only one you have. */
function pick(agent: AgentRef | null, agents: MyAgent[]) {
  if (agent) return agents.find((a) => a.id === agent.id) ?? null;
  return agents.length === 1 ? agents[0] : null;
}

export async function runCommand(text: string): Promise<Outcome> {
  const { agents } = await api<{ agents: MyAgent[] }>("/api/me/agents");
  const refs: AgentRef[] = agents.map((a) => ({ id: a.id, name: a.name, symbol: a.symbol, handle: a.handle }));
  const intent = parse(text, refs);
  const which = () => `Which agent? You have ${agents.map((a) => a.name).join(", ")}.`;

  switch (intent.type) {
    case "help": {
      const s = suggestions(refs);
      return { intent: intent.type, say: `Try: ${s.slice(0, 4).join(". ")}.` };
    }

    case "autopilot": {
      const a = pick(intent.agent, agents);
      if (!a) return { intent: intent.type, say: which() };
      if (a.status !== "live") return { intent: intent.type, say: `${a.name} hasn't launched yet, so copilot can't run.` };
      if (a.autopilotEnabled === intent.on) return { intent: intent.type, say: `${a.name}'s copilot is already ${intent.on ? "on" : "off"}.` };
      await api(`/api/agents/${a.id}`, { method: "PATCH", body: { autopilotEnabled: intent.on } });
      return { intent: intent.type, say: intent.on ? `Copilot is on. ${a.name} will trade ${minutesLabel(a.autopilotIntervalMin)}, inside its limits.` : `Done. ${a.name} is paused and won't trade on its own.` };
    }

    case "interval": {
      const a = pick(intent.agent, agents);
      if (!a) return { intent: intent.type, say: which() };
      await api(`/api/agents/${a.id}`, { method: "PATCH", body: { autopilotIntervalMin: intent.minutes, ...(a.autopilotEnabled ? {} : { autopilotEnabled: true }) } });
      return { intent: intent.type, say: `${a.name} now runs ${minutesLabel(intent.minutes)}${a.autopilotEnabled ? "" : ", and I turned its copilot on"}.` };
    }

    case "balance": {
      const total = agents.reduce((s, a) => s + (a.balanceBnb ?? 0), 0);
      const top = [...agents].sort((x, y) => (y.balanceBnb ?? 0) - (x.balanceBnb ?? 0))[0];
      return {
        intent: intent.type,
        say: agents.length
          ? `Your agents hold ${num(total, 3)} BNB in total.${top?.balanceBnb ? ` ${top.name} has the most, ${num(top.balanceBnb, 3)}.` : ""}`
          : "You don't have any agents yet.",
      };
    }

    case "status": {
      const a = pick(intent.agent, agents);
      if (!a) {
        const live = agents.filter((x) => x.status === "live").length;
        const running = agents.filter((x) => x.autopilotEnabled).length;
        const unread = agents.reduce((s, x) => s + x.unreadMail, 0);
        const jobs = agents.reduce((s, x) => s + x.openJobs, 0);
        return { intent: intent.type, say: `${live} of ${agents.length} agents are live and ${running} in copilot. ${unread} unread emails, ${jobs} open jobs.` };
      }
      const [details, price] = await Promise.all([
        api<AgentDetails>(`/api/agents/${a.id}`),
        a.handle && a.status === "live" ? api<PriceSeries>(`/api/public/${a.handle}/price?range=24h`).catch(() => null) : Promise.resolve(null),
      ]);
      const change = price?.change24h ?? (details.token?.change24hPct == null ? null : details.token.change24hPct / 100);
      const last = details.logs.find((l) => l.kind === "think" || l.kind === "trade");
      const parts = [
        `${a.name} is ${a.status === "live" ? (a.autopilotEnabled ? "running in copilot" : "live, copilot off") : "waiting for its launch funds"}.`,
        change != null ? `Its token is ${change >= 0 ? "up" : "down"} ${pct(Math.abs(change)).replace("+", "")} today.` : "",
        details.wallet.balanceBnb != null ? `Treasury: ${num(details.wallet.balanceBnb, 3)} BNB.` : "",
        last ? `Latest: ${last.message.replace(/^(?:Autopilot|Copilot):\s*/, "")}` : "",
      ];
      return { intent: intent.type, say: parts.filter(Boolean).join(" "), navigate: `/agent/${a.id}` };
    }

    case "read_mail": {
      const scoped = intent.agent ? `/api/agents/${intent.agent.id}/mail?folder=inbox` : "/api/me/mail?unread=1";
      const box = await api<{ messages: (MailMessage & { agent?: { name: string } | null })[] }>(scoped);
      const unread = box.messages.filter((m) => !m.read);
      const list = (unread.length ? unread : box.messages).slice(0, 3);
      if (!list.length) return { intent: intent.type, say: "No new email." };
      const lines = list.map((m) => `From ${m.from.name || m.from.address.split("@")[0]}${m.agent ? ` to ${m.agent.name}` : ""}: ${m.subject || "no subject"}.`);
      return {
        intent: intent.type,
        say: `${unread.length ? `You have ${unread.length} unread.` : "No unread email. Latest:"} ${lines.join(" ")}`,
        navigate: intent.agent ? `/agent/${intent.agent.id}/inbox` : "/mail",
      };
    }

    case "hire": {
      const { listings } = await api<{ listings: Listing[] }>("/api/marketplace");
      const q = intent.target.toLowerCase();
      const hit = listings.find((l) => l.agent.name.toLowerCase().includes(q) || l.offer.title.toLowerCase().includes(q) || q.includes(l.agent.name.toLowerCase()));
      if (!hit) return { intent: intent.type, say: `I couldn't find "${intent.target}" on the marketplace. Opening it so you can look.`, navigate: "/hire" };
      return { intent: intent.type, say: `${hit.agent.name} offers ${hit.offer.title} for ${hit.offer.priceUsd} dollars. Opening it.`, navigate: `/offer/${hit.agent.id}` };
    }

    case "open": {
      const a = pick(intent.agent, agents);
      const to: Record<string, string | undefined> = {
        home: "/",
        mail: "/mail",
        jobs: "/jobs",
        hire: "/hire",
        wallet: "/account",
        explore: "/explore",
        inbox: a ? `/agent/${a.id}/inbox` : "/mail",
        logs: a ? `/agent/${a.id}/activity` : undefined,
        agent: a ? `/agent/${a.id}` : undefined,
      };
      const path = to[intent.screen];
      if (!path) return { intent: intent.type, say: which() };
      return { intent: intent.type, say: "Opening.", navigate: path };
    }

    case "unknown":
      return { intent: intent.type, say: `I heard "${intent.heard}", but I don't know that one yet. Say "help" for ideas.` };
  }
}
