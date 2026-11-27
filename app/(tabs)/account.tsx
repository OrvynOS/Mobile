import { Linking, Share, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { APP_URL } from "@/config";
import { num, short, STATUS, usd } from "@/format";
import { useSession } from "@/session";
import { SOCIAL_WEB, SocialAvatar, type SocialStatus } from "@/social";
import { colors, fonts, space } from "@/theme";
import type { Me, MyAgent } from "@/types";
import { Avatar, Badge, Button, Card, DemoBanner, ErrorText, HeroCard, Notice, P, Press, Row, Screen, Section, Skeleton, Stat, Stats, success, type IconName } from "@/ui";
import { useApi } from "@/useApi";

const PROVIDER: Record<string, string> = { telegram: "Telegram", twitter: "X", x: "X" };
const TONE: Record<string, "good" | "warn" | "bad" | "plain"> = { live: "good", awaiting_funds: "warn", launching: "warn", failed: "bad" };

/** Your profile: who you are on Orvyn (Agent ID, wallet), balances, credits, your agents, Social. */
export default function Account() {
  const { signOut, busy, demo } = useSession();
  const me = useApi<Me>("/api/me");
  const agents = useApi<{ agents: MyAgent[] }>("/api/me/agents");
  const credits = useApi<{ usd: number }>("/api/credits");
  const social = useApi<SocialStatus>("/api/social/me");
  const m = me.data;
  const profile = social.data?.member ? social.data.profile : null;
  const orvynWallet = m?.signInMethod === "privy";
  const name = profile?.name || m?.email || (m?.social?.username ? `@${m.social.username}` : m ? short(m.accountId, 6, 4) : "");
  const via = orvynWallet ? (m?.social ? (PROVIDER[m.social.provider] ?? m.social.provider) : m?.email ? "email" : "Orvyn") : "your own wallet";
  const list = agents.data?.agents ?? [];
  const live = list.filter((a) => a.status === "live").length;
  const stables = m ? (m.balances.usdt ?? 0) + (m.balances.usdc ?? 0) : null;
  const refreshing = me.refreshing || agents.refreshing || credits.refreshing || social.refreshing;
  const refresh = () => {
    void me.refresh();
    void agents.refresh();
    void credits.refresh();
    void social.refresh();
  };
  const copy = async () => {
    if (!m) return;
    await Clipboard.setStringAsync(m.accountId);
    success();
  };

  return (
    <Screen tab refreshing={refreshing} onRefresh={refresh}>
      {demo && <DemoBanner onExit={() => void signOut()} />}
      {me.error && <ErrorText>{me.error}</ErrorText>}
      {!m && !me.error && <Skeleton lines={3} />}
      {m && (
        <>
          {/* Who you are. */}
          <View style={{ alignItems: "center", gap: space(2), paddingTop: space(3) }}>
            {profile ? <SocialAvatar a={profile} size={88} /> : <Avatar icon={null} symbol={name.replace(/[^A-Za-z0-9]/g, "") || "OR"} size={88} />}
            <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6, textAlign: "center" }} numberOfLines={1}>
              {name}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
              {profile ? <Chip accent icon="checkmark-circle" label={`@${profile.handle} · ${profile.agentId}`} onPress={() => Linking.openURL(`${SOCIAL_WEB}/@${profile.handle}`)} /> : <Chip label="No Agent ID yet" />}
              <Chip label={`Signed in with ${via}`} />
              <Chip mono icon="copy-outline" label={short(m.accountId, 6, 4)} onPress={copy} />
            </View>
            {profile?.bio ? <P faint style={{ textAlign: "center" }}>{profile.bio}</P> : null}
          </View>

          {/* At a glance. */}
          <HeroCard label="Your Orvyn" meta={orvynWallet ? "Orvyn wallet" : "Your wallet"}>
            <Stats>
              <Stat label="BNB" value={m.balances.bnb == null ? "—" : num(m.balances.bnb, 4)} />
              <Stat label="USDT + USDC" value={stables == null ? "—" : usd(stables)} />
              <Stat label="Orvyn credits" value={credits.data ? usd(credits.data.usd) : "—"} />
              <Stat label="Agents" value={agents.data ? String(list.length) : "—"} sub={list.length ? `${live} live` : undefined} />
            </Stats>
            <Button title="Share my address" icon="qr-code-outline" onPress={() => Share.share({ message: m.accountId })} />
          </HeroCard>

          {orvynWallet && !m.funded && <Notice icon="water-outline">Your wallet is new: send it a little BNB first (0.005 covers fees). It can&apos;t pay network fees until it has some.</Notice>}

          <Section title="Your agents" action={list.length ? "Create" : undefined} onAction={() => Linking.openURL(`${APP_URL}/create`)}>
            {agents.data && list.length === 0 ? (
              <Card style={{ gap: space(2) }}>
                <P>No agents yet. An agent gets its own wallet, name and OrvynID, and works within limits you set.</P>
                <Button title="Create an agent" icon="add-circle-outline" onPress={() => Linking.openURL(`${APP_URL}/create`)} />
              </Card>
            ) : (
              <Card style={{ paddingVertical: 4 }}>
                {list.map((a, i) => (
                  <Row
                    key={a.id}
                    left={<Avatar icon={a.icon} symbol={a.symbol} size={38} />}
                    title={a.name}
                    subtitle={[a.handle ? `${a.handle}.orvyn.cash` : null, a.agentIdName ? `${a.agentIdName}.ai` : null].filter(Boolean).join(" · ") || "No handle yet"}
                    right={<Badge label={STATUS[a.status] ?? a.status} tone={TONE[a.status] ?? "plain"} />}
                    onPress={() => router.push(`/agent/${a.id}`)}
                    last={i === list.length - 1}
                  />
                ))}
                {!agents.data && <Skeleton lines={2} />}
              </Card>
            )}
          </Section>

          <Section title="Orvyn Social" action={profile ? "Open" : undefined} onAction={() => router.push("/(tabs)/social")}>
            {profile ? (
              <Card>
                <Stats>
                  <Stat label="Posts" value={profile.posts.toLocaleString()} />
                  <Stat label="Followers" value={profile.followers.toLocaleString()} />
                  <Stat label="Following" value={profile.following.toLocaleString()} />
                </Stats>
              </Card>
            ) : (
              <Card style={{ paddingVertical: 4 }}>
                <Row icon="people-outline" iconTone="accent" title="Join Orvyn Social" subtitle="Claim the Agent ID (name.ai) your wallet holds; it becomes your @handle." onPress={() => router.push("/(tabs)/social")} last />
              </Card>
            )}
          </Section>

          <Section title="Wallet">
            <Card style={{ paddingVertical: 4 }}>
              <Row icon="logo-bitcoin" title="BNB" right={<Text style={{ color: colors.fg, fontFamily: fonts.mono, fontSize: 14 }}>{m.balances.bnb == null ? "—" : num(m.balances.bnb, 4)}</Text>} />
              <Row icon="cash-outline" title="USDT" right={<Text style={{ color: colors.fg, fontFamily: fonts.mono, fontSize: 14 }}>{m.balances.usdt == null ? "—" : usd(m.balances.usdt)}</Text>} />
              <Row icon="cash-outline" title="USDC" right={<Text style={{ color: colors.fg, fontFamily: fonts.mono, fontSize: 14 }}>{m.balances.usdc == null ? "—" : usd(m.balances.usdc)}</Text>} />
              <Row icon="key-outline" title="BNB Chain address" subtitle={short(m.accountId, 10, 8)} onPress={copy} />
              <Row icon="open-outline" title="View on BscScan" onPress={() => Linking.openURL(`https://bscscan.com/address/${m.accountId}`)} />
              <Row
                icon="shield-checkmark-outline"
                iconTone="good"
                title={orvynWallet ? "Only you control it" : "Your own wallet"}
                subtitle={orvynWallet ? "Embedded wallet: you approve every transaction. To add funds, send BNB, USDT or USDC on BNB Smart Chain (BEP-20)." : "Signing happens in your wallet app."}
                last
              />
            </Card>
          </Section>

          <Section title="Orvyn">
            <Card style={{ paddingVertical: 4 }}>
              <Row icon="sparkles-outline" iconTone="accent" title="Vyn" subtitle="Your assistant: the same conversations as Vyn desktop" onPress={() => router.push("/vyn")} />
              <Row icon="card-outline" title="Orvyn credits" subtitle={credits.data ? `${usd(credits.data.usd)} for Orvyn Chat and the model API` : "Pay for models with BNB, USDT or USDC"} onPress={() => Linking.openURL(`${APP_URL}/credits`)} />
              <Row icon="book-outline" title="Docs" subtitle="How Orvyn works" onPress={() => Linking.openURL(APP_URL.replace("://app.", "://docs."))} last />
            </Card>
          </Section>
        </>
      )}

      <Button kind="danger" title={demo ? "Exit demo" : "Sign out"} icon="log-out-outline" onPress={() => void signOut()} loading={busy} />
    </Screen>
  );
}

function Chip({ label, icon, accent, mono, onPress }: { label: string; icon?: IconName; accent?: boolean; mono?: boolean; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 11, borderRadius: 999, backgroundColor: accent ? colors.accentSoft : colors.card2 }}>
      {icon ? <Ionicons name={icon} size={13} color={accent ? colors.accent : colors.fg3} /> : null}
      <Text style={{ color: accent ? colors.accent : colors.fg2, fontFamily: mono ? fonts.monoMedium : fonts.textSemi, fontSize: 12.5 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  return onPress ? <Press onPress={onPress}>{body}</Press> : body;
}
