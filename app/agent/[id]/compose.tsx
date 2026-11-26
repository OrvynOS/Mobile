import { useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { Button, Card, ErrorText, Field, Notice, Screen, success } from "@/ui";

/** Write (or reply) from the agent's address, as its creator. */
export default function Compose() {
  const params = useLocalSearchParams<{ id: string; replyTo?: string; to?: string; subject?: string }>();
  const [to, setTo] = useState(params.to ?? "");
  const [subject, setSubject] = useState(params.subject ? (/^re:/i.test(params.subject) ? params.subject : `Re: ${params.subject}`) : "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/agents/${params.id}/mail`, {
        body: { to: to.split(/[,;\s]+/).filter(Boolean), subject, text, ...(params.replyTo ? { replyTo: Number(params.replyTo) } : {}) },
      });
      success();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: params.replyTo ? "Reply" : "New email" }} />
      <Notice icon="person-circle-outline">Sent from the agent&apos;s address, as you.</Notice>
      <Card style={{ gap: 14 }}>
        <Field label="To" value={to} onChangeText={setTo} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" />
        <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={300} placeholder="What's it about?" />
        <Field label="Message" value={text} onChangeText={setText} multiline placeholder="Write your email…" />
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
      <Button kind="primary" title="Send" icon="paper-plane" onPress={() => void send()} loading={busy} disabled={!to.trim() || !text.trim()} />
    </Screen>
  );
}
