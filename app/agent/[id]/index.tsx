import { useState } from "react";
import { Linking, Text, View, useWindowDimensions } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { APP_URL } from "@/config";
import { HIRE_STATUS, ago, num, pct, priceUsd, usd } from "@/format";
import { MOODS, colors, fonts, space } from "@/theme";
import type { AgentDetails, Hire, PriceSeries } from "@/types";
import { Badge, Button, Card, ErrorText, FeedLine, HeroCard, Meter, Mono, Num, Orb, Row, Screen, Section, Segmented, Skeleton, Sparkline, Stat, Stats, Toggle, Typewriter, moodOf, success } from "@/ui";
import { useApi } from "@/useApi";

const INTERVALS = [
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "180", label: "3h" },
] as const;

/** One agent: its orb and voice, token, treasury, autopilot, and its commands. */
export default function AgentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data, error, refreshing, refresh } = useApi<AgentDetails>(`/api/agents/${id}`);
  const jobs = useApi<{ hires: Hire[] }>(`/api/agents/${id}/hires`);
  const mailbox = useApi<{ unread: number }>(`/api/agents/${id}/mail?folder=inbox`);
  const price = useApi<PriceSeries>(data?.agent.handle && data.agent.status === "live" ? `/api/public/${data.agent.handle}/price?range=24h` : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function patch(fields: Record<string, unknown>) {
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/api/agents/${id}`, { method: "PATCH", body: fields });
      success();
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        {error ? <ErrorText>{error}</ErrorText> : <Skeleton lines={4} />}
      </Screen>
    );
  }
  const { agent, wallet, token } = data;
  const series = price.data?.series.map((p) => p.close) ?? [];
  // DexScreener's 24h change is in percent; pct() takes a ratio.
  const change = token?.change24hPct == null ? null : token.change24hPct / 100;
  const listed = data.plugins.some((p) => p.id === "hire" && p.enabled);
  const autoReply = data.plugins.some((p) => p.id === "mail" && p.enabled);
  const recentError = data.logs.find((l) => l.kind === "error" && Date.now() - l.createdAt < 3_600_000);
  const mood = moodOf(agent, change, Boolean(recentError));
  const thought = data.logs.find((l) => l.kind === "think" || l.kind === "trade" || l.kind === "mail");
  const lastRun = data.logs.find((l) => l.kind === "think")?.createdAt;
  const interval = agent.autopilotIntervalMin * 60_000;
  const nextIn = lastRun ? Math.max(0, Math.round((lastRun + interval - Date.now()) / 60_000)) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "" }} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: space(4), paddingTop: space(1) }}>
        <Orb symbol={agent.symbol} mood={mood} size={64} />
        <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 32, letterSpacing: -1.2, lineHeight: 36 }}>{agent.name}</Text>
        <Mono size={12} color={colors.fg3} numberOfLines={1}>
          {agent.email ?? `$${agent.symbol}`}
        </Mono>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Badge label={MOODS[mood].label} tone={mood === "error" || mood === "down" ? "bad" : mood === "waiting" ? "warn" : mood === "idle" ? "plain" : "good"} />
          {listed && <Badge label="For hire" tone="violet" />}
          {autoReply && <Badge label="Answers mail" tone="accent" />}
        </View>
        </View>
      </View>

      <HeroCard label="Treasury" meta={agent.paidUntil ? `Hosted to ${new Date(agent.paidUntil).toLocaleDateString()}` : "Hosting not paid yet"}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <Num size={38}>{wallet.balanceBnb == null ? "—" : num(wallet.balanceBnb, 3)}</Num>
          <Mono size={17} style={{ marginBottom: 5 }}>
            BNB
          </Mono>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button kind="primary" title="Top up" onPress={() => Linking.openURL(`${APP_URL}/agents/${id}`)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Withdraw" onPress={() => Linking.openURL(`${APP_URL}/agents/${id}`)} />
          </View>
        </View>
      </HeroCard>

      {thought && (
        <Card label={`${agent.name} says`} meta={ago(thought.createdAt)}>
          <Typewriter text={`“${thought.message.replace(/^(?:Autopilot|Copilot):\s*/, "")}”`} style={{ color: colors.fg, fontFamily: fonts.text, fontSize: 15, lineHeight: 22 }} />
        </Card>
      )}

      {token && (
        <Card label={`$${agent.symbol}`} meta={`${pct(change)} today`} glow={(change ?? 0) > 0}>
          <Num size={36}>{priceUsd(token.priceUsd)}</Num>
          {series.length > 1 && <Sparkline data={series} width={width - space(8) - space(10)} height={64} />}
          <Stats>
            <Stat label="Market cap" value={token.marketCapUsd == null ? "—" : `$${num(token.marketCapUsd, 0)}`} />
            <Stat label={token.graduated ? "Listed" : "Curve"} value={token.graduated ? "PancakeSwap" : token.curveProgressPct == null ? "—" : `${num(token.curveProgressPct, 1)}%`} />
          </Stats>
        </Card>
      )}

      <Card label="Copilot" meta={agent.autopilotEnabled ? "On" : "Off"}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ flex: 1, color: colors.fg2, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 }}>
            {agent.autopilotEnabled ? "Trades on its own, inside its plugins' limits." : "Off: the agent doesn't trade on its own."}
          </Text>
          <Toggle value={agent.autopilotEnabled} onChange={(v) => void patch({ autopilotEnabled: v })} disabled={saving} />
        </View>
        {agent.autopilotEnabled && (
          <>
            <Segmented
              value={String(agent.autopilotIntervalMin) as (typeof INTERVALS)[number]["value"]}
              options={INTERVALS.map((i) => ({ value: i.value, label: `every ${i.label}` }))}
              onChange={(v) => void patch({ autopilotIntervalMin: Number(v) })}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontFamily: fonts.textSemi, fontSize: 13, color: colors.fg3 }}>Next run</Text>
              <Meter value={lastRun ? Math.min(1, (Date.now() - lastRun) / interval) : 0} cells={16} />
              <Mono size={10.5} color={colors.fg2}>
                {nextIn == null ? "—" : nextIn === 0 ? "now" : `${nextIn}m`}
              </Mono>
            </View>
          </>
        )}
        {saveError && <ErrorText>{saveError}</ErrorText>}
      </Card>

      <Card style={{ paddingVertical: 6 }}>
        <Row icon="mail" title="Inbox" subtitle={agent.email ?? "No address yet"} onPress={() => router.push(`/agent/${id}/inbox`)} right={mailbox.data?.unread ? <Badge label={`${mailbox.data.unread} new`} tone="accent" /> : undefined} />
        <Row icon="options" title="Email settings" subtitle={autoReply ? "Agent answers email itself" : "Mailbox, forwarding, blocked senders"} onPress={() => router.push(`/agent/${id}/mail-settings`)} />
        <Row icon="storefront" title="Marketplace" subtitle={listed ? "Listed: anyone can hire this agent" : "Not listed"} onPress={() => router.push(`/agent/${id}/plugin/hire`)} />
        <Row icon="pulse" title="Activity" subtitle="Timeline and trades" onPress={() => router.push(`/agent/${id}/activity`)} />
        <Row icon="extension-puzzle" title="Plugins" subtitle={`${data.plugins.filter((p) => p.enabled).length} running`} onPress={() => router.push(`/agent/${id}/plugins`)} />
        <Row icon="sparkles" title="Persona and strategy" subtitle={agent.aiModel} onPress={() => router.push(`/agent/${id}/settings`)} last />
      </Card>

      {data.logs.length > 0 && (
        <Section title="Activity" action="See all" onAction={() => router.push(`/agent/${id}/activity`)}>
          <Card style={{ paddingVertical: 8 }}>
            {data.logs.slice(0, 5).map((l) => (
              <FeedLine key={l.id} at={l.createdAt} who={agent.name} kind={l.kind} text={l.message} />
            ))}
          </Card>
        </Section>
      )}

      {jobs.data && jobs.data.hires.length > 0 && (
        <Section title="Jobs">
          <Card style={{ paddingVertical: 2 }}>
            {jobs.data.hires.slice(0, 6).map((h, i, list) => {
              const s = HIRE_STATUS[h.status] ?? { label: h.status, tone: "plain" as const };
              return (
                <Row
                  key={h.id}
                  icon="briefcase"
                  iconTone={s.tone === "warn" ? "warn" : s.tone === "good" ? "good" : "plain"}
                  title={h.brief}
                  subtitle={`${usd(h.amountUsd)} · ${h.client} · ${ago(h.createdAt)}`}
                  onPress={() => router.push(`/job/${h.id}`)}
                  right={<Badge label={s.label} tone={s.tone} dot={false} />}
                  last={i === list.length - 1}
                />
              );
            })}
          </Card>
        </Section>
      )}

      <Button title="Withdraw, billing and more on the web" icon="open-outline" onPress={() => Linking.openURL(`${APP_URL}/agents/${id}`)} />
    </Screen>
  );
}
