import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ago, num } from "@/format";
import { colors, fonts, radius } from "@/theme";
import type { AgentDetails } from "@/types";
import { Badge, Card, Empty, ErrorText, Screen, Segmented, Skeleton, t, type IconName } from "@/ui";
import { useApi } from "@/useApi";

const KIND: Record<string, { icon: IconName; color: string; label: string }> = {
  think: { icon: "sparkles", color: colors.accent, label: "Autopilot" },
  trade: { icon: "swap-horizontal", color: colors.cyan, label: "Trade" },
  fees: { icon: "cash", color: colors.up, label: "Fees" },
  bridge: { icon: "git-network", color: colors.warn, label: "Bridge" },
  mail: { icon: "mail", color: colors.violet, label: "Email" },
  plugin: { icon: "extension-puzzle", color: colors.fg2, label: "Update" },
  error: { icon: "alert-circle", color: colors.down, label: "Needs attention" },
};

/** What the agent did: a timeline of its log (errors included, owner only) and its trades. */
export default function Activity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refreshing, refresh } = useApi<AgentDetails>(`/api/agents/${id}`);
  const [tab, setTab] = useState<"log" | "trades">("log");

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Activity" }} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "log", label: "Timeline" },
          { value: "trades", label: "Trades", count: data?.trades.length || undefined },
        ]}
      />
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={3} />}

      {data && tab === "log" &&
        (data.logs.length ? (
          <View>
            {data.logs.map((l, i) => {
              const k = KIND[l.kind] ?? KIND.plugin;
              return (
                <View key={l.id} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ alignItems: "center", width: 34 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: `${k.color}22`, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={k.icon} size={16} color={k.color} />
                    </View>
                    {i < data.logs.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: colors.line2, marginVertical: 4 }} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 18, gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: k.color, fontFamily: fonts.textSemi, fontSize: 12.5 }}>{k.label}</Text>
                      <Text style={t.hint}>{ago(l.createdAt)}</Text>
                    </View>
                    <Text selectable style={{ color: colors.fg, fontFamily: fonts.text, fontSize: 14.5, lineHeight: 21 }}>
                      {l.message}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Card>
            <Empty title="No activity yet" icon="pulse-outline" />
          </Card>
        ))}

      {data && tab === "trades" &&
        (data.trades.length ? (
          data.trades.map((tr) => {
            const buy = tr.side === "buy" || tr.side === "long";
            const sell = tr.side === "sell" || tr.side === "short";
            return (
              <Card key={tr.id} style={{ opacity: tr.ok ? 1 : 0.6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: buy ? "rgba(52,211,153,0.13)" : sell ? colors.downSoft : colors.card3, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={buy ? "trending-up" : sell ? "trending-down" : "swap-horizontal"} size={20} color={buy ? colors.up : sell ? colors.down : colors.fg2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.fg, fontFamily: fonts.displaySemi, fontSize: 16 }}>
                      {tr.side.toUpperCase()} {tr.symbol.length > 18 ? `${tr.symbol.slice(0, 10)}…` : tr.symbol}
                    </Text>
                    <Text style={t.hint}>
                      {tr.venue} · {ago(tr.createdAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 15 }}>
                      {tr.sizeUnit === "USD" ? `$${num(tr.size, 0)}` : `${num(tr.size, 3)} ${tr.sizeUnit}`}
                    </Text>
                    {!tr.ok && <Badge label="Rejected" tone="bad" dot={false} />}
                  </View>
                </View>
                <Text style={{ color: colors.fg2, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 }}>{tr.rationale}</Text>
              </Card>
            );
          })
        ) : (
          <Card>
            <Empty title="No trades yet" icon="swap-horizontal" />
          </Card>
        ))}
    </Screen>
  );
}
