import { Linking, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { APP_URL } from "@/config";
import { num, short, usd } from "@/format";
import { useSession } from "@/session";
import { colors, fonts, space } from "@/theme";
import type { Me } from "@/types";
import { Avatar, Button, Card, DemoBanner, ErrorText, HeroCard, LargeTitle, Notice, Num, P, Row, Screen, Section, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

const PROVIDER: Record<string, string> = { telegram: "Telegram", twitter: "X", x: "X" };

/** Who you are, your wallet, balances and how to fund it. */
export default function Account() {
  const { signOut, busy, demo } = useSession();
  const { data: me, error, refreshing, refresh } = useApi<Me>("/api/me");
  const orvynWallet = me?.signInMethod === "privy";
  const name = me?.email ?? (me?.social?.username ? `@${me.social.username}` : me ? short(me.accountId, 10, 8) : "");

  return (
    <Screen tab refreshing={refreshing} onRefresh={refresh} header={<LargeTitle eyebrow="Account" title="Wallet" />}>
      {demo && <DemoBanner onExit={() => void signOut()} />}
      {error && <ErrorText>{error}</ErrorText>}
      {!me && !error && <Skeleton lines={2} />}
      {me && (
        <>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Avatar icon={null} symbol={name.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "EL"} size={52} ring />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 19 }} numberOfLines={1}>
                {name}
              </Text>
              <P faint>
                {orvynWallet ? `Signed in with ${me.social ? (PROVIDER[me.social.provider] ?? me.social.provider) : "email"} · your Orvyn wallet` : "Signed in with your own wallet"}
              </P>
            </View>
          </View>

          <HeroCard>
            <Text style={{ color: colors.onAccent, fontFamily: fonts.textBold, fontSize: 15 }}>Balance</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <Num size={38}>{me.balances.bnb == null ? "—" : num(me.balances.bnb, 4)}</Num>
              <Text style={{ color: colors.onAccent, fontFamily: fonts.monoMedium, fontSize: 18, marginBottom: 5 }}>BNB</Text>
            </View>
            <View style={{ flexDirection: "row", gap: space(2) }}>
              <Token label="USDT" value={me.balances.usdt} />
              <Token label="USDC" value={me.balances.usdc} />
            </View>
            <Button title="Share my address" icon="qr-code-outline" onPress={() => Share.share({ message: me.accountId })} />
          </HeroCard>

          {orvynWallet && !me.funded && <Notice icon="water-outline">Your wallet is new: send it a little BNB first (0.005 covers fees). It can&apos;t pay network fees until it has some.</Notice>}

          <Section title="Assistant">
            <Card style={{ paddingVertical: 4 }}>
              <Row icon="sparkles-outline" title="Vyn" subtitle="Your assistant: same conversations as Vyn desktop" onPress={() => router.push("/vyn")} last />
            </Card>
          </Section>

          <Section title="Wallet">
            <Card style={{ paddingVertical: 4 }}>
              <Row icon="key-outline" title="BNB Chain address" subtitle={short(me.accountId, 10, 8)} onPress={() => Share.share({ message: me.accountId })} />
              <Row
                icon="shield-checkmark-outline"
                iconTone="good"
                title={orvynWallet ? "Only you control it" : "Your own wallet"}
                subtitle={orvynWallet ? "Embedded wallet: you approve every transaction." : "Signing happens in your wallet app."}
                last
              />
            </Card>
          </Section>

          {orvynWallet && (
            <Section title="Add funds">
              <Card>
                <P>Send BNB, USDT or USDC to your address from an exchange or another wallet. Choose BNB Smart Chain (BEP-20) when withdrawing.</P>
              </Card>
            </Section>
          )}
        </>
      )}

      <Section title="More">
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="add-circle-outline" title="Create an agent" subtitle="On the web" onPress={() => Linking.openURL(`${APP_URL}/create`)} />
          <Row icon="book-outline" title="Docs" subtitle="How Orvyn works" onPress={() => Linking.openURL(APP_URL.replace("://app.", "://docs."))} last />
        </Card>
      </Section>

      <Button kind="danger" title={demo ? "Exit demo" : "Sign out"} icon="log-out-outline" onPress={() => void signOut()} loading={busy} />
    </Screen>
  );
}

function Token({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.45)", borderRadius: 16, padding: 12 }}>
      <Text style={{ color: colors.onAccent, fontFamily: fonts.textSemi, fontSize: 12.5 }}>{label}</Text>
      <Num size={19}>{value == null ? "—" : usd(value)}</Num>
    </View>
  );
}
