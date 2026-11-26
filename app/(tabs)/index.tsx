import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/api";
import { APP_URL } from "@/config";
import { num, pct } from "@/format";
import { useSession } from "@/session";
import { MOODS, colors, fonts } from "@/theme";
import type { AgentDetails, MyAgent, PriceSeries } from "@/types";
import { Button, Card, DemoBanner, Empty, ErrorText, FeedLine, HeroCard, IconButton, Mono, Num, OsHeader, Orb, P, Press, Screen, Section, Skeleton, Sparkline, moodOf } from "@/ui";
import { useApi } from "@/useApi";

type Agent = MyAgent & { token?: { change24h?: number } | null; createdAt?: number };

/** What needs the owner, in a few words, or what the agent is up to. */
function statusLine(a: Agent, mood: keyof typeof MOODS): { text: string; tone: string } {
  if (a.held) return { text: "Paused by Orvyn", tone: colors.down };
  if (!a.subscriptionActive) return { text: "Hosting expired", tone: colors.down };
  if (a.status !== "live") return { text: "Waiting for funds", tone: colors.warn };
  if (a.unreadMail > 0) return { text: `${a.unreadMail} new email${a.unreadMail > 1 ? "s" : ""}`, tone: colors.fg2 };
  if (a.openJobs > 0) return { text: `Working on ${a.openJobs} job${a.openJobs > 1 ? "s" : ""}`, tone: colors.fg2 };
  return { text: a.autopilotEnabled ? MOODS[mood].label : "Manual", tone: colors.fg2 };
}

/** Home: your agents, what they hold together, and what they've been doing. */
export default function Home() {
  const { demo, signOut } = useSession();
  const { data, error, refreshing, refresh } = useApi<{ agents: Agent[] }>("/api/me/agents");
  const agents = data?.agents ?? [];
  const details = useDetails(agents.map((a) => a.id));

  const treasury = agents.reduce((s, a) => s + (a.balanceBnb ?? 0), 0);
  const unread = agents.reduce((s, a) => s + a.unreadMail, 0);
  const running = agents.filter((a) => a.status === "live" && a.autopilotEnabled).length;
  const needsYou = agents.filter((a) => a.held || !a.subscriptionActive || a.status !== "live").length;

  const feed = Object.entries(details)
    .flatMap(([id, d]) => d.logs.map((l) => ({ ...l, who: agents.find((a) => a.id === id)?.name ?? "agent" })))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  return (
    <Screen
      tab
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <OsHeader
          online={running}
          right={
            <>
              <IconButton icon="chatbubble-ellipses-outline" onPress={() => router.push("/vyn")} />
              <IconButton icon="mail-outline" badge={unread} onPress={() => router.push("/mail")} />
            </>
          }
        />
      }
    >
      <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 38, letterSpacing: -1.6, lineHeight: 42, marginTop: 4 }}>Agents</Text>
      {demo && <DemoBanner onExit={() => void signOut()} />}
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={4} />}

      {data && agents.length === 0 && (
        <Card>
          <Empty title="Launch your first agent" icon="add">
            <P faint style={{ textAlign: "center" }}>
              It gets its own wallet, inbox and income, and a token if you want one. Create it on the web, then run it from here.
            </P>
            <Button kind="primary" title="Create an agent" icon="add" onPress={() => Linking.openURL(`${APP_URL}/create`)} />
          </Empty>
        </Card>
      )}

      {agents.length > 0 && (
        <>
          <HeroCard label="All treasuries" meta={`${agents.length} agent${agents.length > 1 ? "s" : ""}`}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <Num size={42}>{num(treasury, 3)}</Num>
              <Mono size={18} style={{ marginBottom: 6 }}>
                BNB
              </Mono>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.textSemi, fontSize: 14.5, color: colors.onAccent }}>
                {running} working · {agents.length - running} idle
              </Text>
              {needsYou > 0 && (
                <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.onAccent, justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.textBold, fontSize: 13, color: "#FFFFFF" }}>{needsYou} need{needsYou > 1 ? "" : "s"} you</Text>
                </View>
              )}
            </View>
          </HeroCard>

          <View style={{ gap: 10 }}>
            {agents.map((a) => (
              <AgentRow key={a.id} agent={a} details={details[a.id]} />
            ))}
          </View>

          <Button title="Explore agents" icon="compass-outline" onPress={() => router.push("/explore")} />

          {feed.length > 0 && (
            <Section title="Activity">
              <Card style={{ paddingVertical: 8 }}>
                {feed.map((l, i) => (
                  <FeedLine key={`${l.who}-${l.id}`} at={l.createdAt} who={l.who} kind={l.kind} text={l.message} fresh={i === 0 && Date.now() - l.createdAt < 60_000} />
                ))}
              </Card>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

/** Each agent's full details (logs for the feed), refreshed every few seconds. */
function useDetails(ids: string[]) {
  const [details, setDetails] = useState<Record<string, AgentDetails>>({});
  const key = ids.join(",");
  const load = useCallback(async () => {
    const list = await Promise.all(key ? key.split(",").map((id) => api<AgentDetails>(`/api/agents/${id}`).then((d) => [id, d] as const, () => null)) : []);
    setDetails(Object.fromEntries(list.filter((x): x is readonly [string, AgentDetails] => !!x)));
  }, [key]);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [load]);
  return details;
}

/** One agent: avatar with its status, name, what needs you, balance and a 24h line. */
function AgentRow({ agent: a, details }: { agent: Agent; details?: AgentDetails }) {
  const price = useApi<PriceSeries>(a.status === "live" && a.handle ? `/api/public/${a.handle}/price?range=24h` : null);
  const series = price.data?.series.map((p) => p.close) ?? [];
  const change = price.data?.change24h ?? a.token?.change24h ?? null;
  const lastError = details?.logs.find((l) => l.kind === "error" && Date.now() - l.createdAt < 3_600_000);
  const mood = moodOf(a, change, Boolean(lastError));
  const line = statusLine(a, mood);

  return (
    <Press onPress={() => router.push(`/agent/${a.id}`)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 24, backgroundColor: colors.card }}>
        <Orb symbol={a.symbol} mood={mood} size={50} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.fg, fontFamily: fonts.textBold, fontSize: 17 }} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={{ color: line.tone, fontFamily: fonts.textSemi, fontSize: 13.5 }} numberOfLines={1}>
            {line.text}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Mono size={15} color={colors.fg}>
            {a.balanceBnb != null ? num(a.balanceBnb, 3) : "—"}
          </Mono>
          {series.length > 1 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Sparkline data={series} width={44} height={16} />
              <Mono size={11} color={(change ?? 0) >= 0 ? colors.up : colors.down}>
                {pct(change)}
              </Mono>
            </View>
          ) : (
            <Mono size={11} color={colors.fg3}>
              BNB
            </Mono>
          )}
        </View>
      </View>
    </Press>
  );
}
