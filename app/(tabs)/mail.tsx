import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ago } from "@/format";
import { colors, fonts } from "@/theme";
import type { MailMessage } from "@/types";
import { Avatar, Orb, Card, Empty, ErrorText, LargeTitle, P, Row, Screen, Section, Segmented, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

interface MailboxAgent {
  id: string;
  name: string;
  symbol: string;
  icon: string | null;
  email: string | null;
}

/** One inbox across all your agents, plus each agent's mailbox. */
export default function Mail() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, error, refreshing, refresh } = useApi<{ agents: MailboxAgent[]; messages: (MailMessage & { agent: MailboxAgent | null })[] }>(
    `/api/me/mail${filter === "unread" ? "?unread=1" : ""}`,
  );

  return (
    <Screen tab refreshing={refreshing} onRefresh={refresh} header={<LargeTitle eyebrow="Inbox" title="Mail" />}>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={3} />}
      {data && data.agents.length === 0 && (
        <Card>
          <Empty title="No mailboxes yet" icon="mail-outline">
            <P faint style={{ textAlign: "center" }}>Every agent you create gets its own address, handle@orvyn.cash.</P>
          </Empty>
        </Card>
      )}

      {data && data.agents.length > 0 && (
        <>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All mail" },
              { value: "unread", label: "Unread" },
            ]}
          />

          {data.messages.length === 0 ? (
            <Card>
              <Empty title={filter === "unread" ? "All caught up" : "No email yet"} icon={filter === "unread" ? "checkmark-done" : "mail-open-outline"} />
            </Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {data.messages.map((m, i) => (
                <Row
                  key={m.id}
                  unread={!m.read}
                  last={i === data.messages.length - 1}
                  left={<Avatar icon={null} symbol={((m.from.name || m.from.address).replace(/[^A-Za-z]/g, "") || "??").toUpperCase()} size={36} />}
                  title={m.from.name || m.from.address}
                  subtitle={`${m.subject || "(no subject)"} · ${m.preview}`}
                  onPress={() => m.agent && router.push(`/agent/${m.agent.id}/mail/${m.id}`)}
                  right={
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: m.read ? colors.fg3 : colors.accent, fontFamily: fonts.textSemi, fontSize: 11.5 }}>{ago(m.createdAt)}</Text>
                      <Text style={{ color: colors.fg3, fontFamily: fonts.textMedium, fontSize: 11 }}>to {m.agent?.name}</Text>
                    </View>
                  }
                />
              ))}
            </Card>
          )}

          <Section title="Mailboxes">
            <Card style={{ paddingVertical: 4 }}>
              {data.agents.map((a, i) => (
                <Row
                  key={a.id}
                  last={i === data.agents.length - 1}
                  left={<Orb symbol={a.symbol} mood="active" size={42} />}
                  title={a.name}
                  subtitle={a.email ?? "No address yet (needs a handle)"}
                  onPress={() => router.push(`/agent/${a.id}/inbox`)}
                />
              ))}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}
