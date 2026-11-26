import { useEffect, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import type { IconName } from "@/ui";
import { Badge, Button, Card, ErrorText, Field, Notice, Row, Screen, Section, Skeleton, ToggleRow, success } from "@/ui";
import { useApi } from "@/useApi";

interface Settings {
  address: string | null;
  enabled: boolean;
  displayName: string | null;
  defaultDisplayName: string;
  blocked: string[];
  forwardToOwner: boolean;
  forwardTo: string | null;
}

/** The agent's mailbox: on/off, sender name, forwarding, blocked senders, and how the agent answers. */
export default function MailSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refresh } = useApi<Settings>(`/api/agents/${id}/mail/settings`);
  const plugin = useApi<{ installed: boolean; enabled: boolean }>(`/api/agents/${id}/plugins/mail`);
  const [name, setName] = useState("");
  const [blocked, setBlocked] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.displayName ?? "");
    setBlocked(data.blocked.join("\n"));
  }, [data]);

  async function save(patch: Partial<Settings>, done: string) {
    setNote(null);
    setSaveError(null);
    try {
      await api(`/api/agents/${id}/mail/settings`, { method: "PATCH", body: patch });
      success();
      setNote(done);
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Email settings" }} />
        {error ? <ErrorText>{error}</ErrorText> : <Skeleton lines={3} />}
      </Screen>
    );
  }
  const replyState: { label: string; tone: "good" | "warn" | "plain"; icon: IconName } = plugin.data?.installed
    ? plugin.data.enabled
      ? { label: "On", tone: "good", icon: "sparkles" }
      : { label: "Paused", tone: "warn", icon: "pause" }
    : { label: "Off", tone: "plain", icon: "sparkles-outline" };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Email settings" }} />
      {data.address && <Badge label={data.address} tone="accent" />}

      <Card style={{ paddingVertical: 4 }}>
        <ToggleRow icon="mail" title="Receive email" subtitle={data.enabled ? "On" : "Off: new mail is refused"} value={data.enabled} onChange={(v) => void save({ enabled: v }, v ? "Mailbox on." : "Mailbox off.")} />
        <ToggleRow
          icon="arrow-redo"
          title="Forward new mail to me"
          subtitle={data.forwardTo ?? "Sign in with email to add an address"}
          value={data.forwardToOwner}
          disabled={!data.forwardTo && !data.forwardToOwner}
          onChange={(v) => void save({ forwardToOwner: v }, v ? "Forwarding on." : "Forwarding off.")}
          last
        />
      </Card>

      <Section title="Agent replies">
        <Card style={{ paddingVertical: 4 }}>
          <Row
            icon={replyState.icon}
            iconTone="violet"
            title="The agent answers email"
            subtitle={plugin.data?.installed ? "Who it may email, limits, instructions, signature" : "Let it reply on its own, within limits you set"}
            right={<Badge label={replyState.label} tone={replyState.tone} />}
            onPress={() => router.push(`/agent/${id}/plugin/mail`)}
            last
          />
        </Card>
      </Section>

      <Section title="Sender name">
        <Card style={{ gap: 12 }}>
          <Field label="Shown on everything it sends" value={name} onChangeText={setName} placeholder={data.defaultDisplayName} maxLength={64} />
          <Button small title="Save name" icon="checkmark" onPress={() => void save({ displayName: name || null }, "Sender name saved.")} />
        </Card>
      </Section>

      <Section title="Blocked senders">
        <Card style={{ gap: 12 }}>
          <Field
            label="Addresses or domains"
            value={blocked}
            onChangeText={setBlocked}
            multiline
            autoCapitalize="none"
            placeholder={"spammer@example.com\nexample.net"}
            hint="One per line. Their mail goes to Spam and the agent never sees it."
          />
          <Button small title="Save blocked senders" icon="ban" onPress={() => void save({ blocked: blocked.split(/[\s,]+/).filter(Boolean) }, "Blocked senders saved.")} />
        </Card>
      </Section>

      {note && <Notice icon="checkmark-circle">{note}</Notice>}
      {saveError && <ErrorText>{saveError}</ErrorText>}
    </Screen>
  );
}
