import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ago } from "@/format";
import { colors, fonts } from "@/theme";
import type { Mailbox } from "@/types";
import { Avatar, Badge, Button, Card, Empty, ErrorText, IconButton, Notice, Row, Screen, Segmented, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

type Folder = "inbox" | "sent" | "spam";

/** The agent's mailbox at <handle>@orvyn.cash. */
export default function Inbox() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [folder, setFolder] = useState<Folder>("inbox");
  const { data, error, refreshing, refresh } = useApi<Mailbox>(`/api/agents/${id}/mail?folder=${folder}`);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Inbox", headerRight: () => <IconButton icon="options-outline" onPress={() => router.push(`/agent/${id}/mail-settings`)} /> }} />
      {data?.address && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge label={data.address} tone="accent" />
        </View>
      )}
      <Segmented
        value={folder}
        onChange={setFolder}
        options={[
          { value: "inbox", label: "Inbox", count: data?.unread || undefined },
          { value: "sent", label: "Sent" },
          { value: "spam", label: "Spam" },
        ]}
      />
      {data?.enabled && <Button kind="primary" title="Compose" icon="create-outline" onPress={() => router.push(`/agent/${id}/compose`)} />}
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={3} />}
      {data && !data.enabled && <Notice icon="cloud-offline-outline">Email isn&apos;t enabled on this Orvyn deployment yet.</Notice>}
      {data?.messages.length === 0 && (
        <Card>
          <Empty title={folder === "inbox" ? "No email yet" : folder === "sent" ? "Nothing sent yet" : "No spam"} icon={folder === "spam" ? "shield-checkmark-outline" : "mail-open-outline"} />
        </Card>
      )}
      {data && data.messages.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {data.messages.map((m, i) => {
            const who = m.direction === "in" ? m.from.name || m.from.address : m.to.join(", ");
            return (
              <Row
                key={m.id}
                unread={m.direction === "in" ? !m.read : undefined}
                left={<Avatar icon={null} symbol={(who.replace(/[^A-Za-z]/g, "") || "??").toUpperCase()} size={38} />}
                title={m.direction === "in" ? who : `To ${who}`}
                subtitle={`${m.subject || "(no subject)"} · ${m.preview}`}
                onPress={() => router.push(`/agent/${id}/mail/${m.id}`)}
                last={i === data.messages.length - 1}
                right={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ color: colors.fg3, fontFamily: fonts.textSemi, fontSize: 11.5 }}>{ago(m.createdAt)}</Text>
                    {m.author === "agent" ? (
                      <Badge label="Agent" tone="accent" dot={false} />
                    ) : m.status === "failed" || m.status === "bounced" ? (
                      <Badge label={m.status} tone="bad" dot={false} />
                    ) : m.automated && m.direction === "in" ? (
                      <Badge label="Auto" tone="plain" dot={false} />
                    ) : null}
                  </View>
                }
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
