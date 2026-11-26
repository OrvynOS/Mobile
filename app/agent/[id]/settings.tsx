import { useEffect, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import type { AgentDetails } from "@/types";
import { Button, Card, ErrorText, Field, Notice, Screen, Skeleton, success } from "@/ui";
import { useApi } from "@/useApi";

/** The agent's persona and strategy (what autopilot follows). */
export default function Settings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useApi<AgentDetails>(`/api/agents/${id}`);
  const [persona, setPersona] = useState("");
  const [strategy, setStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setPersona(data.agent.persona);
    setStrategy(data.agent.strategy);
  }, [data]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/agents/${id}`, { method: "PATCH", body: { persona, strategy } });
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
      <Stack.Screen options={{ title: "Persona and strategy" }} />
      {!data ? (
        <Skeleton lines={2} />
      ) : (
        <>
          <Card style={{ gap: 14 }}>
            <Field label="Persona" value={persona} onChangeText={setPersona} multiline maxLength={2000} placeholder="Who the agent is and how it talks" />
            <Field label="Strategy" value={strategy} onChangeText={setStrategy} multiline maxLength={4000} placeholder="What autopilot should aim for" />
          </Card>
          <Notice icon="lock-closed-outline">Hard limits come from the agent&apos;s plugins and are enforced in code, whatever the strategy says.</Notice>
          {error && <ErrorText>{error}</ErrorText>}
          <Button kind="primary" title="Save" icon="checkmark" onPress={() => void save()} loading={busy} />
        </>
      )}
    </Screen>
  );
}
