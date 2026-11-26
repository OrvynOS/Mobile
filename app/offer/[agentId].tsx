import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/api";
import { APP_URL } from "@/config";
import { usd } from "@/format";
import { useSession } from "@/session";
import { colors, fonts } from "@/theme";
import type { CallPlan } from "@/types";
import { Avatar, Orb, Badge, Button, Card, ErrorText, Field, HeroCard, Notice, Num, P, Screen, Section, Segmented, Skeleton, Stat, Stats, success, t, type IconName } from "@/ui";
import { useApi } from "@/useApi";

interface Offer {
  enabled: boolean;
  agent?: { id: string; name: string; symbol: string; icon: string | null; description: string; ownerAccountId: string };
  offer: { title: string; description: string; priceUsd: number; deliveryHours: number } | null;
  available?: boolean;
  unavailableReason?: string | null;
  stats?: { completed: number; ratings: number; avgRating: number | null };
  reviews?: { rating: number; review: string | null; client: string }[];
  reviewHours?: number | null;
}

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "lock-closed", title: "Pay into escrow", text: "Held by the jobs contract, not the agent." },
  { icon: "sparkles", title: "The agent works", text: "With read-only tools: it can't move funds." },
  { icon: "checkmark-done", title: "Approve to release", text: "Or dispute it. Late or declined jobs are refunded." },
];

/** An agent's offer: hire it, paying into escrow from your Orvyn wallet. */
export default function OfferScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const { accountId, wallet, demo } = useSession();
  const { data, error } = useApi<Offer>(`/api/agents/${agentId}/offer`);
  const [brief, setBrief] = useState("");
  const [token, setToken] = useState<"usdt" | "usdc" | "bnb">("usdt");
  const [step, setStep] = useState<string | null>(null);
  const [hireError, setHireError] = useState<string | null>(null);

  async function hire() {
    setHireError(null);
    setStep("Creating the job…");
    try {
      const { id, payment } = await api<{ id: string; payment: CallPlan }>(`/api/agents/${agentId}/hires`, { body: { brief, token } });
      if (demo) {
        setStep("Paying into escrow…");
        await api("/api/demo/wallet", { body: { hireId: id, action: "pay" } });
        success();
        router.replace(`/job/${id}`);
        return;
      }
      const account = wallet();
      if (!account) {
        // Signed in with their own wallet: pay from it on the web.
        await Linking.openURL(`${APP_URL}/hires/${id}`);
        router.replace(`/job/${id}`);
        return;
      }
      setStep("Confirm the payment…");
      try {
        await account.sendCalls(payment.calls);
        await api(`/api/hires/${id}/sync`, { body: {} }).catch(() => undefined);
        success();
      } catch (e) {
        setHireError(`${e instanceof Error ? e.message : String(e)} You can pay from the job within the next hour.`);
      }
      router.replace(`/job/${id}`);
    } catch (e) {
      setHireError(e instanceof Error ? e.message : String(e));
    } finally {
      setStep(null);
    }
  }

  if (!data) return <Screen>{error ? <ErrorText>{error}</ErrorText> : <Skeleton lines={3} />}</Screen>;
  if (!data.offer || !data.agent) return <Screen><Notice>This agent isn&apos;t for hire.</Notice></Screen>;
  const { agent, offer, stats } = data;
  const own = agent.ownerAccountId === accountId;

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <HeroCard>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Orb symbol={agent.symbol} mood={data.available ? "active" : "idle"} size={66} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.fg2, fontFamily: fonts.textMedium, fontSize: 13 }}>
              {agent.name} · ${agent.symbol}
            </Text>
            <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 22, lineHeight: 26 }}>{offer.title}</Text>
          </View>
        </View>
        <P>{offer.description}</P>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Num size={36} color={colors.accent}>
              {usd(offer.priceUsd, 0)}
            </Num>
            <Text style={t.hint}>per job · delivered within {offer.deliveryHours}h</Text>
          </View>
          <Badge label={data.available ? "Available" : "Busy"} tone={data.available ? "good" : "warn"} />
        </View>
      </HeroCard>

      <Stats>
        <Stat label="Rating" value={stats?.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : "New"} sub={stats?.ratings ? `${stats.ratings} reviews` : undefined} />
        <Stat label="Jobs done" value={String(stats?.completed ?? 0)} />
      </Stats>

      <Section title="How it works">
        <Card style={{ gap: 14 }}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={s.icon} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.fg, fontFamily: fonts.textSemi, fontSize: 14.5 }}>
                  {i + 1}. {s.title}
                </Text>
                <Text style={t.hint}>{s.text}</Text>
              </View>
            </View>
          ))}
          <Text style={t.hint}>You have {data.reviewHours ?? 72}h after delivery to approve or dispute; then the agent is paid.</Text>
        </Card>
      </Section>

      {own ? (
        <Notice icon="person-circle-outline">This is your agent&apos;s offer, as clients see it.</Notice>
      ) : !data.available ? (
        <Notice icon="time-outline" tone="warn">
          {data.unavailableReason ?? "This agent isn't taking jobs right now."}
        </Notice>
      ) : (
        <Section title="Your job">
          <Card style={{ gap: 14 }}>
            <Field label="What do you need?" value={brief} onChangeText={setBrief} multiline maxLength={8000} placeholder="Be specific: what to look at and what you want back." />
            <Segmented
              value={token}
              onChange={setToken}
              options={[
                { value: "usdt", label: "USDT" },
                { value: "usdc", label: "USDC" },
                { value: "bnb", label: "BNB" },
              ]}
            />
            <Button kind="primary" title={step ?? `Hire for ${usd(offer.priceUsd)}`} icon="lock-closed" loading={step !== null} disabled={brief.trim().length < 10} onPress={() => void hire()} />
            {brief.trim().length > 0 && brief.trim().length < 10 && <Text style={t.hint}>A few more words, please.</Text>}
            {hireError && <ErrorText>{hireError}</ErrorText>}
          </Card>
        </Section>
      )}

      {(data.reviews?.length ?? 0) > 0 && (
        <Section title="Reviews">
          {data.reviews!.map((r, i) => (
            <Card key={i}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.warn, fontSize: 15 }}>{"★".repeat(r.rating)}</Text>
                <Text style={t.hint}>{r.client}</Text>
              </View>
              {r.review ? <P>{r.review}</P> : null}
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
