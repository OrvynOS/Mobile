import "@/polyfills";
import { useEffect, type ReactNode } from "react";
import { Appearance } from "react-native";
import { reloadAppAsync } from "expo";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import {
  useFonts,
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from "@expo-google-fonts/schibsted-grotesk";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { SessionProvider, useSession } from "@/session";
import { PRIVY_ENABLED } from "@/config";
import { colors, fonts, scheme } from "@/theme";
import { Loading } from "@/ui";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Styles are built for one theme at launch (src/theme.ts): when the phone switches between light and
// dark, reload so every screen is rebuilt in the new palette.
Appearance.addChangeListener(({ colorScheme }) => {
  if ((colorScheme === "light" ? "light" : "dark") !== scheme) void reloadAppAsync("theme changed").catch(() => undefined);
});

function Gate() {
  const { ready, accountId } = useSession();
  const segments = useSegments();

  // Signed out → sign-in screen; signed in → out of it.
  useEffect(() => {
    if (!ready) return;
    const onSignIn = segments[0] === "sign-in";
    if (!accountId && !onSignIn) router.replace("/sign-in");
    else if (accountId && onSignIn) router.replace("/");
  }, [ready, accountId, segments]);

  // Tapping a notification opens what it's about.
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const path = response?.notification.request.content.data?.path;
      if (typeof path === "string" && path.startsWith("/")) router.push(path as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  if (!ready) return <Loading />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.fg,
        headerTitleStyle: { fontFamily: fonts.textBold, fontSize: 17, color: colors.fg },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="voice" options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="vyn" options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  );
}

/** Privy's provider and UI (only when Privy is configured, so the demo runs in Expo Go). */
function WithPrivy({ children }: { children: ReactNode }) {
  if (!PRIVY_ENABLED) return <>{children}</>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrivyRoot } = require("@/privy") as typeof import("@/privy");
  return <PrivyRoot>{children}</PrivyRoot>;
}

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded || failed) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, failed]);
  if (!loaded && !failed) return null;

  return (
    <WithPrivy>
      <SessionProvider>
        <StatusBar style={scheme === "light" ? "dark" : "light"} />
        <Gate />
      </SessionProvider>
    </WithPrivy>
  );
}
