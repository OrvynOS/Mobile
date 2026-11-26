import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/api";
import { colors, fonts } from "@/theme";
import { Button, Card, ErrorText, Field, HeroCard, P, Press, Screen, Section, Skeleton, ToggleRow, success, t } from "@/ui";
import { useApi } from "@/useApi";

type Value = number | boolean | string | string[];
type SettingField =
  | { key: string; label: string; help?: string; type: "number"; default: number; min: number; max: number; unit?: string }
  | { key: string; label: string; help?: string; type: "boolean"; default: boolean }
  | { key: string; label: string; help?: string; type: "text"; default: string; maxLength: number; multiline?: boolean }
  | { key: string; label: string; help?: string; type: "list"; default: string[]; maxItems: number }
  | { key: string; label: string; help?: string; type: "select"; default: string; options: { value: string; label: string }[] };

interface PluginForm {
  id: string;
  name: string;
  summary: string;
  description: string;
  fields: SettingField[];
  installed: boolean;
  enabled: boolean;
  config: Record<string, Value>;
}

const TITLES: Record<string, string> = { mail: "Agent email replies", hire: "Marketplace listing" };
const HEROES: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string }> = {
  mail: { icon: "sparkles", title: "Let the agent answer its email" },
  hire: { icon: "storefront", title: "Get paid for your agent's work" },
};

/**
 * One plugin's settings, rendered from the plugin's own form spec (the same one the web uses).
 * Used for email auto-replies (Orvyn Mail) and the marketplace listing (Hire me).
 */
export default function PluginSettings() {
  const { id, pluginId } = useLocalSearchParams<{ id: string; pluginId: string }>();
  const { data, error, refresh } = useApi<PluginForm>(`/api/agents/${id}/plugins/${pluginId}`);
  const [values, setValues] = useState<Record<string, Value>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setValues(data.config);
  }, [data]);

  // List fields are edited as text, one item per line.
  const toConfig = () =>
    Object.fromEntries(
      (data?.fields ?? []).map((f) => {
        const v = values[f.key];
        if (f.type === "list") return [f.key, (Array.isArray(v) ? v : String(v ?? "").split(/\n|,/)).map((s) => s.trim()).filter(Boolean)];
        if (f.type === "number") return [f.key, Number(v)];
        return [f.key, v];
      }),
    );

  /** Runs a change and reloads; false (with the error shown) if it was refused. */
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    try {
      await fn();
      success();
      await refresh();
      setSaved(true);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: TITLES[pluginId] ?? "Plugin" }} />
        {error ? <ErrorText>{error}</ErrorText> : <Skeleton lines={3} />}
      </Screen>
    );
  }
  const hero = HEROES[pluginId];
  const set = (key: string, v: Value) => setValues((s) => ({ ...s, [key]: v }));
  const toggles = data.fields.filter((f) => f.type === "boolean");

  return (
    <Screen>
      <Stack.Screen options={{ title: TITLES[pluginId] ?? data.name }} />

      <HeroCard>
        {hero && (
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={hero.icon} size={23} color={colors.accent} />
          </View>
        )}
        <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 21 }}>{hero?.title ?? data.name}</Text>
        <P>{data.description}</P>
      </HeroCard>

      {data.installed && (
        <Card style={{ paddingVertical: 4 }}>
          <ToggleRow
            icon="power"
            title={data.enabled ? "On" : "Off"}
            subtitle={pluginId === "hire" ? (data.enabled ? "Listed on the marketplace" : "Hidden from the marketplace") : data.name}
            value={data.enabled}
            disabled={busy}
            onChange={(v) => void run(() => api(`/api/agents/${id}/plugins/${pluginId}`, { method: "PATCH", body: { enabled: v } }))}
            last
          />
        </Card>
      )}

      {toggles.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {toggles.map((f, i) => (
            <ToggleRow key={f.key} title={f.label} subtitle={f.help} value={Boolean(values[f.key])} onChange={(b) => set(f.key, b)} last={i === toggles.length - 1} />
          ))}
        </Card>
      )}

      {data.fields
        .filter((f) => f.type === "select")
        .map((f) =>
          f.type === "select" ? (
            <Section key={f.key} title={f.label}>
              <Card style={{ gap: 8 }}>
                {f.options.map((o) => {
                  const on = values[f.key] === o.value;
                  return (
                    <Press key={o.value} onPress={() => set(f.key, o.value)}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.accent : colors.line2, backgroundColor: on ? colors.accentSoft : "transparent" }}>
                        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.accent : colors.fg3} />
                        <Text style={{ color: colors.fg, fontFamily: fonts.textMedium, fontSize: 14.5, flex: 1 }}>{o.label}</Text>
                      </View>
                    </Press>
                  );
                })}
              </Card>
            </Section>
          ) : null,
        )}

      <Section title="Details">
        <Card style={{ gap: 16 }}>
          {data.fields
            .filter((f) => f.type === "text" || f.type === "number" || f.type === "list")
            .map((f) => {
              const v = values[f.key];
              const hint = [f.help, f.type === "list" ? `One per line, up to ${f.maxItems}.` : "", f.type === "number" ? `${f.min} to ${f.max}${f.unit ? ` ${f.unit}` : ""}.` : ""].filter(Boolean).join(" ");
              return (
                <Field
                  key={f.key}
                  label={f.type === "number" && f.unit ? `${f.label} (${f.unit})` : f.label}
                  value={f.type === "list" ? (Array.isArray(v) ? v.join("\n") : String(v ?? "")) : String(v ?? "")}
                  onChangeText={(text) => set(f.key, text)}
                  keyboardType={f.type === "number" ? "numeric" : "default"}
                  multiline={f.type === "list" || (f.type === "text" && f.multiline)}
                  autoCapitalize={f.type === "list" ? "none" : "sentences"}
                  maxLength={f.type === "text" ? f.maxLength : undefined}
                  hint={hint || undefined}
                />
              );
            })}
        </Card>
      </Section>

      {saveError && <ErrorText>{saveError}</ErrorText>}
      {saved && !saveError && <Text style={[t.hint, { color: colors.accent, textAlign: "center" }]}>Saved</Text>}
      {data.installed ? (
        <Button kind="primary" title="Save changes" icon="checkmark" loading={busy} onPress={() => void run(() => api(`/api/agents/${id}/plugins/${pluginId}`, { method: "PATCH", body: { config: toConfig() } }))} />
      ) : (
        <Button
          kind="primary"
          title={pluginId === "hire" ? "List on the marketplace" : "Turn on"}
          icon={pluginId === "hire" ? "storefront" : "power"}
          loading={busy}
          onPress={() => void run(() => api(`/api/agents/${id}/plugins`, { body: { pluginId, config: toConfig() } }))}
        />
      )}

      {data.installed && (
        <Button
          kind="danger"
          title={pluginId === "hire" ? "Remove from the marketplace" : "Remove"}
          icon="trash-outline"
          onPress={() =>
            Alert.alert(`Remove ${data.name}?`, "You can add it again later.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => void run(() => api(`/api/agents/${id}/plugins/${pluginId}`, { method: "DELETE" })).then((ok) => ok && router.back()) },
            ])
          }
        />
      )}
    </Screen>
  );
}
