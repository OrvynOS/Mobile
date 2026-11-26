import { useState } from "react";
import { Linking } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { APP_URL } from "@/config";
import { num } from "@/format";
import type { AgentDetails } from "@/types";
import { Button, Card, Empty, ErrorText, Row, Screen, Skeleton, Toggle, success, type IconName } from "@/ui";
import { useApi } from "@/useApi";

const ICON: Record<string, IconName> = { capability: "flash", data: "analytics", knowledge: "book" };
/** Plugins with a settings screen in the app; the rest are configured on the web. */
const IN_APP = new Set(["mail", "hire"]);

/** Switch the agent's Bliss plugins on or off. */
export default function Plugins() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refreshing, refresh } = useApi<AgentDetails>(`/api/agents/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function toggle(pluginId: string, enabled: boolean) {
    setBusy(pluginId);
    setToggleError(null);
    try {
      await api(`/api/agents/${id}/plugins/${pluginId}`, { method: "PATCH", body: { enabled } });
      success();
      await refresh();
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Plugins" }} />
      {(error || toggleError) && <ErrorText>{error ?? toggleError}</ErrorText>}
      {!data && !error && <Skeleton lines={3} />}
      {data && data.plugins.length === 0 && (
        <Card>
          <Empty title="No plugins yet" icon="extension-puzzle-outline" />
        </Card>
      )}
      {data && data.plugins.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {data.plugins.map((p, i) => (
            <Row
              key={p.id}
              icon={ICON[p.category] ?? "extension-puzzle"}
              iconTone={p.enabled ? "accent" : "plain"}
              title={p.name}
              subtitle={`${p.category}${p.feeSharePct > 0 ? ` · ${p.feeSharePct}% of fees · ${num(p.budgetBnb, 4)} BNB budget` : ""}${IN_APP.has(p.id) ? " · tap to edit" : ""}`}
              onPress={IN_APP.has(p.id) ? () => router.push(`/agent/${id}/plugin/${p.id}`) : undefined}
              right={<Toggle value={p.enabled} disabled={busy === p.id} onChange={(v) => void toggle(p.id, v)} />}
              last={i === data.plugins.length - 1}
            />
          ))}
        </Card>
      )}
      <Button title="Add plugins on the web" icon="open-outline" onPress={() => Linking.openURL(`${APP_URL}/agents/${id}`)} />
    </Screen>
  );
}
