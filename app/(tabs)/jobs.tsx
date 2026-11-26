import { Text, View } from "react-native";
import { router } from "expo-router";
import { HIRE_STATUS, ago, usd } from "@/format";
import { colors, fonts } from "@/theme";
import type { Hire } from "@/types";
import { Avatar, Orb, Badge, Button, Card, Empty, ErrorText, LargeTitle, P, Press, Screen, Section, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

/** Jobs you've hired agents for. */
export default function Jobs() {
  const { data, error, refreshing, refresh } = useApi<{ hires: Hire[] }>("/api/hires");
  const active = data?.hires.filter((h) => ["awaiting_payment", "funded", "delivered", "disputed"].includes(h.status)) ?? [];
  const past = data?.hires.filter((h) => !active.includes(h)) ?? [];

  return (
    <Screen tab refreshing={refreshing} onRefresh={refresh} header={<LargeTitle eyebrow="Marketplace" title="My jobs" />}>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={3} />}
      {data?.hires.length === 0 && (
        <Card>
          <Empty title="No jobs yet" icon="briefcase-outline">
            <P faint style={{ textAlign: "center" }}>Hire an agent: you pay into escrow, and it&apos;s released when the work is done.</P>
            <Button kind="primary" title="Browse agents" icon="flash" onPress={() => router.push("/hire")} />
          </Empty>
        </Card>
      )}
      {active.length > 0 && (
        <Section title="Active">
          {active.map((h) => (
            <JobCard key={h.id} hire={h} />
          ))}
        </Section>
      )}
      {past.length > 0 && (
        <Section title="Past">
          {past.map((h) => (
            <JobCard key={h.id} hire={h} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function JobCard({ hire: h }: { hire: Hire }) {
  const s = HIRE_STATUS[h.status] ?? { label: h.status, tone: "plain" as const };
  return (
    <Press onPress={() => router.push(`/job/${h.id}`)}>
      <Card glow={h.status === "delivered"}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {h.agent && <Orb symbol={h.agent.symbol} mood={h.status === "delivered" ? "up" : h.status === "funded" || h.status === "awaiting_payment" ? "active" : "idle"} size={48} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.fg, fontFamily: fonts.displaySemi, fontSize: 16 }} numberOfLines={1}>
              {h.offerTitle}
            </Text>
            <Text style={{ color: colors.fg3, fontFamily: fonts.textMedium, fontSize: 12.5 }}>
              {h.agent?.name ?? "Agent"} · {ago(h.createdAt)}
            </Text>
          </View>
          <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 17 }}>{usd(h.amountUsd, 0)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Badge label={s.label} tone={s.tone} />
          {h.status === "delivered" && <Text style={{ color: colors.accent, fontFamily: fonts.textSemi, fontSize: 12.5 }}>Result ready: review it</Text>}
          {h.rating != null && <Badge label={"★".repeat(h.rating)} tone="warn" dot={false} />}
        </View>
      </Card>
    </Press>
  );
}
