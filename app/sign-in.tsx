import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/session";
import { colors, fonts, space } from "@/theme";
import { Button, ErrorText, FadeIn, GridBackdrop, LogoMark } from "@/ui";

/** Boot lines typed out on the sign-in screen, one after another. */
const BOOT = [
  ["agent runtime", "ok"],
  ["wallets · mpc + embedded", "ok"],
  ["mail · @orvyn.cash", "ok"],
  ["escrow · bnb chain", "ok"],
] as const;

export default function SignIn() {
  const { signInWithPrivy, signInWithWallet, startDemo, busy, error, privyAvailable } = useSession();
  const [lines, setLines] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLines((n) => (n >= BOOT.length ? (clearInterval(id), n) : n + 1)), 380);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GridBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space(6), justifyContent: "space-between", gap: space(8) }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: space(6), marginTop: space(6) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LogoMark size={26} />
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.fg, letterSpacing: -0.8 }}>orvyn</Text>
            </View>

            <View style={{ alignItems: "center", paddingVertical: space(4) }}>
              <View style={{ width: 168, height: 168, borderRadius: 168, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center" }}>
                <LogoMark size={104} color={colors.onAccent} node={colors.onAccent} />
              </View>
            </View>

            <View style={{ gap: space(2) }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 34, lineHeight: 39, letterSpacing: -1 }}>Agents that earn{"\n"}their keep.</Text>
              <Text style={{ color: colors.fg2, fontFamily: fonts.text, fontSize: 15.5, lineHeight: 22 }}>Launch them, fund them, and run them from your pocket.</Text>
            </View>

            <View style={{ gap: 8, padding: 16, borderRadius: 24, backgroundColor: colors.card }}>
              {BOOT.slice(0, lines).map(([what, status]) => (
                <FadeIn key={what} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: fonts.textMedium, fontSize: 14, color: colors.fg2 }}>{what}</Text>
                  <Text style={{ fontFamily: fonts.textSemi, fontSize: 13, color: colors.up }}>{status}</Text>
                </FadeIn>
              ))}
            </View>
          </View>

          <FadeIn delay={500} style={{ gap: space(3) }}>
            <Button kind="primary" title="Continue with email, X or Google" icon="mail" onPress={signInWithPrivy} loading={busy && privyAvailable} />
            <Button title="Connect your wallet" icon="wallet-outline" onPress={() => void signInWithWallet()} disabled={busy} />
            <Button kind="ghost" title="Run the demo" icon="play" onPress={() => void startDemo()} disabled={busy} />
            <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 12.5, textAlign: "center" }}>New here? You get your own Orvyn wallet on first sign-in. Only you can use it.</Text>
            {error && <ErrorText>{error}</ErrorText>}
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
