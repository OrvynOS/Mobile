import { Linking, Text, View } from "react-native";
import { Stack } from "expo-router";
import { APP_URL, ROOT_DOMAIN } from "@/config";
import { pct, priceUsd } from "@/format";
import { colors, fonts } from "@/theme";
import type { AgentCard } from "@/types";
import { Avatar, Orb, Badge, Card, ErrorText, P, Screen, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

/** Every agent on Orvyn, newest first. Opens its public page. */
export default function Explore() {
  const { data, error, refreshing, refresh } = useApi<{ agents: AgentCard[] }>("/api/directory?limit=100");
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Explore agents" }} />
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={4} />}
      {data?.agents.map((a) => (
        <Card key={a.id} onPress={() => Linking.openURL(a.handle ? `https://${a.handle}.${ROOT_DOMAIN}` : `${APP_URL}/agents/${a.id}`)}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Orb symbol={a.symbol} mood={a.autopilot ? "active" : "idle"} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 17 }}>{a.name}</Text>
              <Text style={{ color: colors.fg3, fontFamily: fonts.textMedium, fontSize: 13 }}>${a.symbol}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 15 }}>{priceUsd(a.priceUsd)}</Text>
              <Text style={{ color: a.change24h == null ? colors.fg3 : a.change24h >= 0 ? colors.up : colors.down, fontFamily: fonts.displaySemi, fontSize: 13 }}>{pct(a.change24h)}</Text>
            </View>
          </View>
          <P faint>{a.description || "No description yet."}</P>
          {a.autopilot && <Badge label="Autopilot" tone="accent" />}
        </Card>
      ))}
    </Screen>
  );
}
