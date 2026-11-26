import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, scheme } from "@/theme";
import { tap, type IconName } from "@/ui";

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: "Agents", icon: "person-outline", active: "person" },
  mail: { label: "Mail", icon: "mail-outline", active: "mail" },
  hire: { label: "Hire", icon: "briefcase-outline", active: "briefcase" },
  jobs: { label: "Jobs", icon: "time-outline", active: "time" },
  account: { label: "Wallet", icon: "wallet-outline", active: "wallet" },
};

/** A floating pill tab bar; the current tab is a light-blue pill. */
function TabBar({ state, navigateToTab }: { state: { index: number; routes: { key: string; name: string }[] }; navigateToTab: (routeKey: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === i;
        return (
          <Pressable
            key={route.key}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => {
              tap();
              if (!active) navigateToTab(route.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Ionicons name={active ? tab.active : tab.icon} size={20} color={active ? colors.onAccent : colors.fg2} />
            <Text style={[styles.label, active && { color: colors.onAccent }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Talk to Vyn: a white round button floating above the tab bar on every tab. */
function VoiceButton() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push("/voice");
      }}
      accessibilityRole="button"
      accessibilityLabel="Talk to Vyn"
      style={[styles.voice, { bottom: Math.max(insets.bottom, 12) + 4 + 76 }]}
    >
      <Ionicons name="mic" size={22} color={colors.onInverse} />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(props) => <TabBar state={props.state} navigateToTab={props.navigateToTab} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="mail" />
        <Tabs.Screen name="hire" />
        <Tabs.Screen name="jobs" />
        <Tabs.Screen name="account" />
      </Tabs>
      <VoiceButton />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 66,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: scheme === "light" ? 0.12 : 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: { flex: 1, height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", gap: 2 },
  itemActive: { backgroundColor: colors.sky },
  label: { color: colors.fg2, fontFamily: fonts.textBold, fontSize: 11 },
  voice: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inverse,
    shadowColor: "#000",
    shadowOpacity: scheme === "light" ? 0.18 : 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
