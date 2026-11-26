import { useEffect, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/api";
import { APP_URL } from "@/config";
import { HIRE_STATUS, ago, usd } from "@/format";
import { useSession } from "@/session";
import { colors, fonts } from "@/theme";
import type { CallPlan, Hire } from "@/types";
import { Badge, Bubble, Button, Card, ErrorText, Field, HeroCard, Notice, Num, P, Press, Screen, Section, Skeleton, success, t } from "@/ui";
import { useApi } from "@/useApi";

interface JobResponse {
  hire: Hire;
  agent: { id: string; name: string; email: string | null };
  contract: string | null;
  payment: CallPlan | null;
}

const STAGES = ["Paid", "Working", "Delivered", "Paid out"];
const stageOf = (status: string) => ({ awaiting_payment: -1, funded: 1, delivered: 2, disputed: 2, released: 3, resolved: 3 })[status] ?? -1;

/** One marketplace job, for its client or the agent's creator. */
export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wallet, demo } = useSession();
  const { data, error, refreshing, refresh } = useApi<JobResponse>(`/api/hires/${id}`);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState("");
  const [stars, setStars] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // While the job is moving (paid, being worked on), keep it fresh.
  const status = data?.hire.status;
  useEffect(() => {
    if (status !== "awaiting_payment" && status !== "funded" && status !== "delivered") return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [status, refresh]);

  /** A wallet action: in the demo it just happens; with the Orvyn wallet it's signed here; their own wallet uses the web. */
  async function walletAction(label: string, run: (account: NonNullable<ReturnType<typeof wallet>>) => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      if (demo) await api("/api/demo/wallet", { body: { hireId: id, action: label } });
      else {
        const account = wallet();
        if (!account) {
          await Linking.openURL(`${APP_URL}/hires/${id}`);
          return;
        }
        await run(account);
        await api(`/api/hires/${id}/sync`, { body: {} }).catch(() => undefined);
      }
      success();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /** The client's escrow call, built by the API, sent from the embedded wallet. */
  async function escrow(account: NonNullable<ReturnType<typeof wallet>>, action: "approve" | "dispute" | "reclaim", reason?: string) {
    const plan = await api<CallPlan>(`/api/hires/${id}/action`, { body: { action, reason } });
    return account.sendCalls(plan.calls);
  }

  async function send() {
    setBusy("message");
    setActionError(null);
    try {
      await api(`/api/hires/${id}/messages`, { body: { text: message } });
      setMessage("");
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <Screen>{error ? <ErrorText>{error}</ErrorText> : <Skeleton lines={3} />}</Screen>;
  const { hire, contract } = data;
  const s = HIRE_STATUS[hire.status] ?? { label: hire.status, tone: "plain" as const };
  const isClient = hire.role === "client";
  const inReview = hire.status === "delivered" && hire.reviewEndsAt != null && Date.now() < hire.reviewEndsAt;
  const open = ["awaiting_payment", "funded", "delivered", "disputed"].includes(hire.status);
  const stage = stageOf(hire.status);
  const mine = isClient ? "client" : "owner";

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "" }} />

      <HeroCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.fg2, fontFamily: fonts.textMedium, fontSize: 13 }}>
              {isClient ? `Hired ${data.agent.name}` : `Job for ${data.agent.name} · from ${hire.client}`}
            </Text>
            <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 21, lineHeight: 25 }}>{hire.offerTitle}</Text>
          </View>
          <Num size={24} color={colors.accent}>
            {usd(hire.amountUsd, 0)}
          </Num>
        </View>
        <Badge label={s.label} tone={s.tone} />
        {stage >= 0 && hire.status !== "refunded" && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {STAGES.map((label, i) => (
              <View key={label} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? "transparent" : i <= stage ? colors.accent : colors.line2 }} />
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i <= stage ? colors.accent : colors.card3, borderWidth: 1, borderColor: i <= stage ? colors.accent : colors.line2, alignItems: "center", justifyContent: "center" }}>
                    {i <= stage ? <Ionicons name="checkmark" size={13} color={colors.onAccent} /> : null}
                  </View>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === STAGES.length - 1 ? "transparent" : i < stage ? colors.accent : colors.line2 }} />
                </View>
                <Text style={{ color: i <= stage ? colors.fg : colors.fg3, fontFamily: fonts.textSemi, fontSize: 11 }}>{label}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={t.hint}>
          Due {new Date(hire.deadlineAt).toLocaleString()}
          {hire.reviewEndsAt ? ` · review ends ${new Date(hire.reviewEndsAt).toLocaleString()}` : ""}
        </Text>
      </HeroCard>

      {isClient && hire.status === "awaiting_payment" && data.payment && (
        <Button kind="primary" title={`Pay ${usd(hire.amountUsd)} into escrow`} icon="lock-closed" loading={busy === "pay"} onPress={() => void walletAction("pay", (a) => a.sendCalls(data.payment!.calls))} />
      )}

      <Section title="Brief">
        <Card>
          <Text selectable style={t.mono}>
            {hire.brief}
          </Text>
        </Card>
      </Section>

      <Section title="Result">
        <Card glow={Boolean(hire.result)}>
          {hire.result ? (
            <Text selectable style={t.mono}>
              {hire.result}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Ionicons name={hire.status === "funded" ? "hourglass-outline" : "time-outline"} size={18} color={colors.fg3} />
              <P faint style={{ flex: 1 }}>
                {hire.status === "funded" ? "The agent is working on it…" : hire.status === "awaiting_payment" ? "Work starts once the payment is in escrow." : "No result."}
              </P>
            </View>
          )}
        </Card>
      </Section>

      {isClient && contract && (hire.status === "funded" || hire.status === "delivered") && (
        <Button
          kind="primary"
          title="Approve and pay the agent"
          icon="checkmark-done"
          loading={busy === "approve"}
          onPress={() =>
            Alert.alert("Approve this job?", "The agent is paid from escrow. This can't be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Approve", onPress: () => void walletAction("approve", (a) => escrow(a, "approve")) },
            ])
          }
        />
      )}
      {isClient && contract && inReview && (
        <Button
          kind="danger"
          title="Dispute"
          icon="flag-outline"
          loading={busy === "dispute"}
          onPress={() =>
            Alert.alert("Dispute this delivery?", "Orvyn reviews the job and decides how to split the payment. Tell the agent what's wrong in a message first.", [
              { text: "Cancel", style: "cancel" },
              { text: "Dispute", style: "destructive", onPress: () => void walletAction("dispute", (a) => escrow(a, "dispute", message.slice(0, 1000))) },
            ])
          }
        />
      )}
      {isClient && contract && hire.status === "funded" && !hire.result && Date.now() > hire.deadlineAt && (
        <Button title="Take your payment back" icon="return-down-back" loading={busy === "reclaim"} onPress={() => void walletAction("reclaim", (a) => escrow(a, "reclaim"))} />
      )}
      {!isClient && (hire.status === "funded" || hire.status === "delivered") && hire.pendingAction !== "refund" && (
        <Button
          kind="danger"
          title="Decline and refund"
          icon="close-circle-outline"
          onPress={() =>
            Alert.alert("Decline this job?", "The client is refunded in full.", [
              { text: "Cancel", style: "cancel" },
              { text: "Decline", style: "destructive", onPress: () => void api(`/api/hires/${id}/decline`, { body: { reason: message } }).then(refresh) },
            ])
          }
        />
      )}
      {hire.pendingAction && <Notice icon="sync-outline">Orvyn is recording this on chain…</Notice>}
      {actionError && <ErrorText>{actionError}</ErrorText>}

      <Section title="Conversation">
        <Card style={{ gap: 12 }}>
          {hire.messages.length === 0 && <P faint>No messages yet.</P>}
          {hire.messages.map((m) => (
            <Bubble
              key={m.id}
              side={m.author === "system" ? "system" : m.author === mine ? "me" : "them"}
              text={m.text}
              meta={`${m.author === "agent" ? data.agent.name : m.author === "client" ? (isClient ? "You" : "Client") : m.author === "owner" ? (isClient ? "Creator" : "You") : ""} · ${ago(m.at)}${m.viaEmail ? " · email" : ""}`}
            />
          ))}
          {open && (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Field label={isClient ? "Message the agent" : "Message the client"} value={message} onChangeText={setMessage} multiline maxLength={4000} placeholder="Write a message…" />
              <Button title="Send" icon="paper-plane" loading={busy === "message"} disabled={!message.trim()} onPress={() => void send()} />
            </View>
          )}
        </Card>
      </Section>

      {isClient && (hire.status === "released" || hire.status === "resolved") && hire.rating == null && (
        <Section title="Rate this job">
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Press key={n} onPress={() => setStars(n)}>
                  <Ionicons name={n <= stars ? "star" : "star-outline"} size={34} color={colors.warn} />
                </Press>
              ))}
            </View>
            <Field label="Review (public, optional)" value={review} onChangeText={setReview} multiline maxLength={1000} />
            <Button kind="primary" title="Submit rating" icon="star" onPress={() => void api(`/api/hires/${id}/rating`, { body: { rating: stars, review } }).then(() => (success(), refresh()), (e: Error) => setActionError(e.message))} />
          </Card>
        </Section>
      )}
      {hire.rating != null && (
        <Card>
          <Text style={{ color: colors.warn, fontSize: 18, textAlign: "center" }}>{"★".repeat(hire.rating)}</Text>
          <P faint style={{ textAlign: "center" }}>
            {isClient ? "Thanks for rating this job." : "The client rated this job."}
          </P>
        </Card>
      )}
    </Screen>
  );
}
