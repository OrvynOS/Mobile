import { Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { ago } from "@/format";
import { colors, fonts } from "@/theme";
import type { MailMessage } from "@/types";
import { Avatar, Badge, Bubble, Button, Card, ErrorText, H1, P, Screen, Skeleton, t } from "@/ui";
import { useApi } from "@/useApi";

/** One email, with the rest of its conversation as a chat (opening it marks it read). */
export default function MailMessageScreen() {
  const { id, messageId } = useLocalSearchParams<{ id: string; messageId: string }>();
  const { data, error } = useApi<{ message: MailMessage; thread: MailMessage[] }>(`/api/agents/${id}/mail/${messageId}`);

  if (!data) {
    return <Screen>{error ? <ErrorText>{error}</ErrorText> : <Skeleton lines={2} />}</Screen>;
  }
  const m = data.message;
  const tone = (r: string) => (r === "pass" ? "good" : r === "fail" ? "bad" : "plain");
  const sender = m.direction === "in" ? m.from.name || m.from.address : m.author === "agent" ? "The agent" : "You";
  const earlier = [...data.thread].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <H1>{m.subject || "(no subject)"}</H1>

      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Avatar icon={null} symbol={(sender.replace(/[^A-Za-z]/g, "") || "??").toUpperCase()} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.fg, fontFamily: fonts.textSemi, fontSize: 15 }}>{sender}</Text>
          <Text style={t.hint}>
            {m.direction === "in" ? m.from.address : `to ${m.to.join(", ")}`} · {ago(m.createdAt)}
          </Text>
        </View>
        {m.author === "agent" && <Badge label="Agent" tone="accent" dot={false} />}
      </View>

      {m.auth && (
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {(["spf", "dkim", "dmarc"] as const).map((k) => (
            <Badge key={k} label={`${k.toUpperCase()} ${m.auth![k]}`} tone={tone(m.auth![k])} />
          ))}
        </View>
      )}

      {earlier.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={t.label}>Earlier in this conversation</Text>
          {earlier.map((e) => (
            <Bubble key={e.id} side={e.direction === "out" ? "me" : "them"} text={e.text ?? e.preview} meta={`${e.direction === "out" ? (e.author === "agent" ? "Agent" : "You") : e.from.name || e.from.address} · ${ago(e.createdAt)}`} />
          ))}
        </View>
      )}

      <Card>
        <Text selectable style={t.mono}>
          {m.text}
        </Text>
      </Card>

      {m.delivery && (
        <Card style={{ gap: 6 }}>
          <Text style={t.label}>Delivery</Text>
          {Object.entries(m.delivery).map(([rcpt, d]) => (
            <View key={rcpt} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <P style={{ flex: 1 }}>{rcpt}</P>
              <Badge label={d.status === "pending" ? "delivering" : d.status} tone={d.status === "sent" ? "good" : d.status === "failed" ? "bad" : "warn"} />
            </View>
          ))}
        </Card>
      )}

      {m.direction === "in" && m.status === "received" && (
        <Button kind="primary" title="Reply" icon="arrow-undo" onPress={() => router.push({ pathname: "/agent/[id]/compose", params: { id, replyTo: String(m.id), to: m.from.address, subject: m.subject } })} />
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {m.direction === "in" && (
          <View style={{ flex: 1 }}>
            <Button
              title={m.status === "spam" ? "Not spam" : "Spam"}
              icon={m.status === "spam" ? "checkmark-circle-outline" : "ban-outline"}
              onPress={() => void api(`/api/agents/${id}/mail/${m.id}`, { method: "PATCH", body: { spam: m.status !== "spam" } }).then(() => router.back())}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button kind="danger" title="Delete" icon="trash-outline" onPress={() => void api(`/api/agents/${id}/mail/${m.id}`, { method: "DELETE" }).then(() => router.back())} />
        </View>
      </View>
    </Screen>
  );
}
