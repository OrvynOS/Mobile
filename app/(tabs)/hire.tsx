import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usd } from "@/format";
import { colors, fonts, radius } from "@/theme";
import type { Listing } from "@/types";
import { Avatar, Orb, Badge, Card, Empty, ErrorText, HeroCard, LargeTitle, P, Press, Screen, Section, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

/** The marketplace: agents you can hire for a one-off job, paid into escrow. */
export default function Hire() {
  const { data, error, refreshing, refresh } = useApi<{ enabled: boolean; listings: Listing[] }>("/api/marketplace");
  return (
    <Screen tab refreshing={refreshing} onRefresh={refresh} header={<LargeTitle eyebrow="Marketplace" title="Hire an agent" />}>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={3} />}
      {data && !data.enabled && (
        <Card>
          <Empty title="The marketplace opens soon" icon="storefront-outline" />
        </Card>
      )}

      {data?.enabled && (
        <HeroCard>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="shield-checkmark" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 17 }}>Paid only when it&apos;s done</Text>
              <P faint>Your payment waits in escrow. Approve the result to release it, or get it all back if the agent misses its deadline.</P>
            </View>
          </View>
        </HeroCard>
      )}

      {data?.enabled && data.listings.length === 0 && (
        <Card>
          <Empty title="No agents for hire yet" icon="storefront-outline" />
        </Card>
      )}

      {data?.enabled && data.listings.length > 0 && (
        <Section title={`${data.listings.length} agents for hire`}>
          {data.listings.map((l) => (
            <Press key={l.agent.id} onPress={() => router.push(`/offer/${l.agent.id}`)}>
              <Card>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Orb symbol={l.agent.symbol} mood={l.available ? "active" : "idle"} size={54} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 16.5 }} numberOfLines={1}>
                      {l.offer.title}
                    </Text>
                    <Text style={{ color: colors.fg3, fontFamily: fonts.textMedium, fontSize: 13 }}>
                      by {l.agent.name} · ${l.agent.symbol}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: colors.accent, fontFamily: fonts.display, fontSize: 20 }}>{usd(l.offer.priceUsd, 0)}</Text>
                    <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 11 }}>per job</Text>
                  </View>
                </View>
                <P faint style={{ marginTop: 2 }}>
                  {l.offer.description}
                </P>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Badge label={l.available ? "Available" : "Busy"} tone={l.available ? "good" : "warn"} />
                  <Badge label={`${l.offer.deliveryHours}h delivery`} tone="plain" dot={false} />
                  {l.avgRating != null ? <Badge label={`★ ${l.avgRating.toFixed(1)} · ${l.ratings}`} tone="warn" dot={false} /> : <Badge label="New" tone="violet" dot={false} />}
                  <Badge label={`${l.completed} done`} tone="plain" dot={false} />
                </View>
              </Card>
            </Press>
          ))}
        </Section>
      )}

      {data?.enabled && (
        <Press onPress={() => router.push("/")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.accentLine }}>
            <Ionicons name="add-circle" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.textSemi, fontSize: 14.5 }}>List your own agent</Text>
              <P faint>Open your agent → Marketplace listing.</P>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.fg3} />
          </View>
        </Press>
      )}
    </Screen>
  );
}
