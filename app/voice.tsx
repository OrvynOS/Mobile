/**
 * Voice: talk to Orvyn. Say (or type, or tap) a command; Orvyn does it and answers out loud.
 * Listening needs the app build (native speech recognition); in Expo Go you type or tap instead,
 * and the spoken replies still work.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors, fonts, radius, space } from "@/theme";
import type { MyAgent } from "@/types";
import { GridBackdrop, Mono, Press, Typewriter, success, tap } from "@/ui";
import { suggestions } from "@/voice/intents";
import { runCommand } from "@/voice/run";
import * as stt from "@/voice/stt";

type Phase = "idle" | "listening" | "thinking" | "answered" | "error";

/** Vyn listens, thinks and answers with her face. */
const MOOD_FACE: Record<Phase, keyof typeof FACE> = { idle: "idle", listening: "attentive", thinking: "thinking", answered: "happy", error: "sorry" };
const FACE = {
  idle: require("../assets/vyn/idle.png"),
  attentive: require("../assets/vyn/attentive.png"),
  thinking: require("../assets/vyn/thinking.png"),
  happy: require("../assets/vyn/happy.png"),
  sorry: require("../assets/vyn/sorry.png"),
};
const STATUS: Record<Phase, string> = { idle: "READY", listening: "LISTENING", thinking: "WORKING", answered: "DONE", error: "ERROR" };

/** A row of bars that dance while Orvyn is listening. */
function Wave({ active }: { active: boolean }) {
  const [h, setH] = useState<number[]>(() => Array(28).fill(0.12));
  useEffect(() => {
    if (!active) {
      setH(Array(28).fill(0.12));
      return;
    }
    const id = setInterval(() => setH((prev) => prev.map((_, i) => 0.15 + Math.abs(Math.sin(Date.now() / 160 + i * 0.7)) * (0.35 + Math.random() * 0.5))), 90);
    return () => clearInterval(id);
  }, [active]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 34 }}>
      {h.map((v, i) => (
        <View key={i} style={{ width: 3, height: Math.max(3, v * 34), backgroundColor: active ? colors.accent : colors.line2, opacity: active ? 0.55 + v * 0.45 : 1 }} />
      ))}
    </View>
  );
}

export default function Voice() {
  const insets = useSafeAreaInsets();
  const canListen = useRef(stt.available()).current;
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState(canListen ? "Tap the mic and tell me what to do." : "Type a command or tap one below. I'll do it and answer out loud.");
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [chips, setChips] = useState<string[]>(suggestions([]));
  const [history, setHistory] = useState<{ you: string; orvyn: string }[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const heardRef = useRef("");
  const leaving = useRef(false);

  // Suggestions that use your agents' names.
  useEffect(() => {
    api<{ agents: MyAgent[] }>("/api/me/agents")
      .then(({ agents }) => setChips(suggestions(agents.map((a) => ({ id: a.id, name: a.name, symbol: a.symbol, handle: a.handle })))))
      .catch(() => undefined);
  }, []);

  // Stop listening and talking when the screen closes (unless we're leaving to show something).
  useEffect(
    () => () => {
      stt.cancel();
      if (!leaving.current) void Speech.stop();
    },
    [],
  );

  const speak = useCallback(
    (text: string) => {
      void Speech.stop();
      if (!muted) Speech.speak(text, { language: "en-US", rate: Platform.OS === "ios" ? 0.52 : 1.0, pitch: 1.0 });
    },
    [muted],
  );

  const run = useCallback(
    async (text: string) => {
      const said = text.trim();
      if (!said) return;
      setHeard(said);
      setPhase("thinking");
      tap();
      try {
        const out = await runCommand(said);
        setReply(out.say);
        setPhase("answered");
        setHistory((h) => [{ you: said, orvyn: out.say }, ...h].slice(0, 6));
        success();
        speak(out.say);
        if (out.navigate) {
          const to = out.navigate;
          setTimeout(() => {
            leaving.current = true;
            router.back();
            router.navigate(to as never);
          }, 1600);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setReply(msg);
        setPhase("error");
        speak(msg);
      }
    },
    [speak],
  );

  const startListening = useCallback(async () => {
    void Speech.stop();
    heardRef.current = "";
    setHeard("");
    setReply("");
    setPhase("listening");
    tap();
    try {
      stopRef.current = await stt.listen({
        onText: (text) => {
          heardRef.current = text;
          setHeard(text);
        },
        onEnd: () => {
          stopRef.current = null;
          const text = heardRef.current;
          if (text) void run(text);
          else {
            setPhase("idle");
            setReply("I didn't catch that. Tap the mic and try again.");
          }
        },
        onError: (message) => {
          stopRef.current = null;
          setPhase("error");
          setReply(message);
        },
      });
    } catch (e) {
      setPhase("error");
      setReply(e instanceof Error ? e.message : "Couldn't start listening.");
    }
  }, [run]);

  // Open straight into listening when the build can.
  useEffect(() => {
    if (canListen) void startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMic = () => {
    if (phase === "listening") stopRef.current?.();
    else if (phase !== "thinking") void startListening();
  };

  const submitTyped = () => {
    const text = typed;
    setTyped("");
    void run(text);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GridBackdrop />
      {/* Title bar */}
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space(2) : space(4) }]}>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.fg }}>
          orvyn<Text style={{ fontFamily: fonts.monoBold, color: colors.accent, fontSize: 14 }}>//VOICE</Text>
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Press
            onPress={() => {
              setMuted((m) => !m);
              void Speech.stop();
            }}
          >
            <View style={s.square}>
              <Ionicons name={muted ? "volume-mute-outline" : "volume-high-outline"} size={17} color={muted ? colors.fg3 : colors.fg} />
            </View>
          </Press>
          <Press onPress={() => router.back()}>
            <View style={s.square}>
              <Ionicons name="close" size={18} color={colors.fg} />
            </View>
          </Press>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space(4), paddingBottom: space(6), gap: space(4) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* The orb and what's happening */}
        <View style={{ alignItems: "center", paddingTop: space(4), gap: space(3) }}>
          <Pressable onPress={onMic} accessibilityRole="button" accessibilityLabel={phase === "listening" ? "Stop listening" : "Speak a command"}>
            <Image source={FACE[MOOD_FACE[phase]]} style={{ width: 180, height: 180 }} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: phase === "error" ? colors.down : phase === "listening" ? colors.up : colors.accent }} />
            <Text style={{ fontFamily: fonts.textSemi, fontSize: 13.5, color: colors.fg2 }}>
              {STATUS[phase].charAt(0) + STATUS[phase].slice(1).toLowerCase()}
              {!canListen ? " · typing" : ""}
            </Text>
          </View>
          <Wave active={phase === "listening"} />
        </View>

        {/* Transcript */}
        <View style={s.panel}>
          <Text style={s.label}>You</Text>
          <Text style={[s.heard, !heard && { color: colors.fg3 }]}>
            {heard || (phase === "listening" ? "listening…" : "…")}
          </Text>
          <Text style={[s.label, { marginTop: space(2), color: phase === "error" ? colors.down : colors.accent }]}>Vyn</Text>
          {phase === "thinking" ? <Text style={[s.reply, { color: colors.fg3 }]}>working…</Text> : reply ? <Typewriter key={reply} text={reply} style={s.reply} /> : null}
        </View>

        {/* Mic */}
        {canListen && (
          <Press onPress={onMic} disabled={phase === "thinking"}>
            <View style={[s.mic, phase === "listening" && { backgroundColor: colors.down }]}>
              <Ionicons name={phase === "listening" ? "stop" : "mic"} size={20} color={colors.onAccent} />
              <Text style={s.micText}>{phase === "listening" ? "Done" : "Tap to speak"}</Text>
            </View>
          </Press>
        )}

        {/* Type a command */}
        <View style={s.inputRow}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={submitTyped}
            placeholder={canListen ? "or type a command" : "type a command"}
            placeholderTextColor={colors.fg3}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
          <Press onPress={submitTyped} disabled={!typed.trim() || phase === "thinking"}>
            <View style={[s.send, !typed.trim() && { backgroundColor: colors.card }]}>
              <Ionicons name="arrow-up" size={16} color={typed.trim() ? colors.onAccent : colors.fg3} />
            </View>
          </Press>
        </View>

        {/* Try saying */}
        <View style={{ gap: space(2) }}>
          <Text style={s.label}>Try saying</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {chips.map((c) => (
              <Press key={c} onPress={() => void run(c)} disabled={phase === "thinking" || phase === "listening"}>
                <View style={s.chip}>
                  <Text style={s.chipText}>{c}</Text>
                </View>
              </Press>
            ))}
          </View>
        </View>

        {/* Earlier this session */}
        {history.length > 1 && (
          <View style={{ gap: space(2) }}>
            <Text style={s.label}>Earlier</Text>
            {history.slice(1).map((h, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ fontFamily: fonts.textSemi, fontSize: 14, color: colors.fg }}>{h.you}</Text>
                <Text style={{ fontFamily: fonts.text, fontSize: 13, color: colors.fg3, lineHeight: 18 }} numberOfLines={2}>
                  {h.orvyn}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space(4), paddingBottom: space(3) },
  square: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card },
  panel: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), gap: space(1) },
  label: { fontFamily: fonts.textSemi, fontSize: 13.5, color: colors.fg3 },
  heard: { fontFamily: fonts.textMedium, fontSize: 17, color: colors.fg, lineHeight: 24 },
  reply: { fontFamily: fonts.text, fontSize: 16, color: colors.fg, lineHeight: 23 },
  mic: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.sky },
  micText: { fontFamily: fonts.textBold, fontSize: 16, color: colors.onAccent },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.pill, backgroundColor: colors.card, paddingLeft: space(5), paddingRight: 6, minHeight: 54 },
  input: { flex: 1, color: colors.fg, fontFamily: fonts.text, fontSize: 16, paddingVertical: 10 },
  send: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.sky },
  chip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontFamily: fonts.textMedium, fontSize: 14, color: colors.fg },
});
