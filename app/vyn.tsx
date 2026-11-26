/**
 * Vyn on the phone: the same conversations as Vyn desktop (they live on Orvyn's server), so a task
 * started on the computer continues here. The phone runs the tools it can: answering Vyn's
 * questions and approving payments (a native alert with the exact merchant and amount). Browsing
 * happens in Vyn desktop. Her face follows her mood; she can read replies aloud, and you can talk
 * to her with the mic.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors, fonts, radius, space } from "@/theme";
import { ErrorText, GridBackdrop, Mono, P, tap } from "@/ui";
import * as stt from "@/voice/stt";

type Mood = "idle" | "happy" | "thinking" | "curious" | "attentive" | "sorry" | "sleepy" | "talking";
const FACES: Record<Mood, number> = {
  idle: require("../assets/vyn/idle.png"),
  happy: require("../assets/vyn/happy.png"),
  thinking: require("../assets/vyn/thinking.png"),
  curious: require("../assets/vyn/curious.png"),
  attentive: require("../assets/vyn/attentive.png"),
  sorry: require("../assets/vyn/sorry.png"),
  sleepy: require("../assets/vyn/sleepy.png"),
  talking: require("../assets/vyn/talking.png"),
};

const TOOLS = ["ask_person", "approve_payment", "approve_binance"] as const;
interface ToolCall {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}
interface Turn {
  text: string;
  toolCalls: ToolCall[];
  done: boolean;
  mood?: Mood;
}
interface Thread {
  id: string;
  title: string;
}
interface Line {
  kind: "you" | "vyn" | "tool";
  text: string;
}

/** Text of a stored model message. */
function textOf(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((p: { type?: string }) => p.type === "text").map((p: { text?: string }) => p.text ?? "").join("");
  return "";
}

const approve = (i: Record<string, unknown>) =>
  new Promise<{ approved: boolean }>((resolve) =>
    Alert.alert(
      "Approve payment",
      `Pay ${Number(i.amount).toFixed(2)} ${String(i.currency).toUpperCase()} to ${String(i.merchant)}?\n\n${String(i.description)}\nMethod: ${String(i.method)}`,
      [
        { text: "Decline", style: "cancel", onPress: () => resolve({ approved: false }) },
        { text: "Approve", onPress: () => resolve({ approved: true }) },
      ],
      { cancelable: true, onDismiss: () => resolve({ approved: false }) },
    ),
  );

/** A Binance action: Orvyn runs exactly this call, and only if the person approves. */
const approveBinance = (i: Record<string, unknown>) =>
  new Promise<{ approved: boolean }>((resolve) =>
    Alert.alert(
      "Approve Binance action",
      `${String(i.summary ?? i.tool)}

It runs on your Binance Agentic sub-account only if you approve.`,
      [
        { text: "Decline", style: "cancel", onPress: () => resolve({ approved: false }) },
        { text: "Approve", onPress: () => resolve({ approved: true }) },
      ],
      { cancelable: true, onDismiss: () => resolve({ approved: false }) },
    ),
  );

export default function Vyn() {
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [question, setQuestion] = useState<{ text: string; choices: string[] } | null>(null);
  const [mood, setMood] = useState<Mood>("idle");
  const [aloud, setAloud] = useState(false);
  const [talking, setTalking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListening = useRef<(() => void) | null>(null);
  const answerRef = useRef<((a: string) => void) | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const add = (line: Line) => setLines((l) => [...l, line]);

  useEffect(() => {
    if (!talking) return;
    const t = setInterval(() => setMouthOpen((o) => !o), 180);
    return () => clearInterval(t);
  }, [talking]);
  // Happy and sorry settle back to idle.
  useEffect(() => {
    if (mood !== "happy" && mood !== "sorry") return;
    const t = setTimeout(() => setMood("idle"), 6000);
    return () => clearTimeout(t);
  }, [mood]);
  const say = (text: string) => {
    if (!aloud || !text) return;
    Speech.stop();
    Speech.speak(text.replace(/[🌀-🫿]/gu, ""), { pitch: 1.1, rate: 1.0, onStart: () => setTalking(true), onDone: () => setTalking(false), onStopped: () => setTalking(false), onError: () => setTalking(false) });
  };
  async function toggleMic() {
    tap();
    if (listening) {
      stopListening.current?.();
      return;
    }
    try {
      setListening(true);
      stopListening.current = await stt.listen({
        onText: (text) => setInput(text),
        onEnd: () => setListening(false),
        onError: (m) => {
          setListening(false);
          setError(m);
        },
      });
    } catch (e) {
      setListening(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const loadThread = useCallback(async (id: string) => {
    setThreadId(id);
    const r = await api<{ messages: { message: { role: string; content: unknown } }[] }>(`/api/vyn/threads/${id}`);
    setLines(
      r.messages
        .map(({ message }) => ({ kind: message.role === "user" ? ("you" as const) : ("vyn" as const), text: textOf(message.content), role: message.role }))
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.text)
        .map(({ kind, text }) => ({ kind, text })),
    );
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await api<{ settings: unknown }>("/api/vyn/settings");
      if (!s.settings) return setNeedsSetup(true);
      let { threads: list } = await api<{ threads: Thread[] }>("/api/vyn/threads");
      if (!list.length) list = [(await api<{ thread: Thread }>("/api/vyn/threads", { method: "POST", body: {} })).thread];
      setThreads(list);
      await loadThread(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loadThread]);
  useEffect(() => void load(), [load]);

  async function runTool(call: ToolCall): Promise<unknown> {
    if (call.toolName === "approve_payment") {
      setMood("attentive");
      add({ kind: "tool", text: `Approve ${call.input.amount} ${call.input.currency} to ${call.input.merchant}?` });
      return approve(call.input);
    }
    if (call.toolName === "approve_binance") {
      setMood("attentive");
      add({ kind: "tool", text: `Binance: ${String(call.input.summary ?? call.input.tool)}?` });
      return approveBinance(call.input);
    }
    if (call.toolName === "ask_person") {
      setMood("curious");
      setQuestion({ text: String(call.input.question ?? ""), choices: (call.input.choices as string[] | undefined) ?? [] });
      const answer = await new Promise<string>((resolve) => (answerRef.current = resolve));
      setQuestion(null);
      add({ kind: "you", text: answer });
      return { answer };
    }
    return { error: "this tool runs on Vyn desktop" };
  }

  async function send() {
    const text = input.trim();
    if (!text || !threadId || busy) return;
    tap();
    setBusy(true);
    setError(null);
    setInput("");
    add({ kind: "you", text });
    setMood("thinking");
    try {
      let turn = await api<Turn>(`/api/vyn/threads/${threadId}/turn`, { method: "POST", body: { text, tools: TOOLS, device: "mobile" } });
      for (let i = 0; i < 25; i++) {
        if (turn.mood) setMood(turn.mood);
        if (turn.text) {
          add({ kind: "vyn", text: turn.text });
          say(turn.text);
        }
        if (turn.done) break;
        const toolResults = [];
        for (const call of turn.toolCalls) toolResults.push({ toolCallId: call.toolCallId, toolName: call.toolName, output: await runTool(call) });
        turn = await api<Turn>(`/api/vyn/threads/${threadId}/turn`, { method: "POST", body: { toolResults, tools: TOOLS, device: "mobile" } });
      }
    } catch (e) {
      setMood("sorry");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function newThread() {
    tap();
    const { thread } = await api<{ thread: Thread }>("/api/vyn/threads", { method: "POST", body: {} });
    setThreads((t) => [thread, ...t]);
    setLines([]);
    setThreadId(thread.id);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GridBackdrop />
      <View style={{ paddingTop: insets.top + space(2), paddingHorizontal: space(4), flexDirection: "row", alignItems: "center", gap: space(2) }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-down" size={24} color={colors.fg2} />
        </Pressable>
        <Image source={FACES[talking ? (mouthOpen ? "talking" : "idle") : mood]} style={{ width: 44, height: 44 }} accessibilityLabel={`Vyn, ${mood}`} />
        <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 18, flex: 1 }}>Vyn</Text>
        <Pressable
          onPress={() => {
            tap();
            setAloud((a) => {
              if (a) Speech.stop();
              return !a;
            });
          }}
          hitSlop={12}
          accessibilityLabel={aloud ? "Stop reading replies aloud" : "Read replies aloud"}
        >
          <Ionicons name={aloud ? "volume-high" : "volume-mute"} size={22} color={aloud ? colors.accent : colors.fg2} />
        </Pressable>
        <Pressable onPress={() => void newThread()} hitSlop={12}>
          <Ionicons name="add" size={24} color={colors.fg2} />
        </Pressable>
      </View>

      {threads.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space(2) }} contentContainerStyle={{ paddingHorizontal: space(4), gap: 6 }}>
          {threads.map((t) => (
            <Pressable key={t.id} onPress={() => void loadThread(t.id)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: t.id === threadId ? colors.accent : colors.line }}>
              <Mono size={11} color={t.id === threadId ? colors.accent : colors.fg2} numberOfLines={1}>
                {t.title.slice(0, 24)}
              </Mono>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {needsSetup ? (
        <View style={{ padding: space(6), gap: space(2) }}>
          <P>Vyn runs on your own AI key. Set it up in Vyn desktop (or on app.orvyn.cash), then come back: your conversations follow you here.</P>
        </View>
      ) : (
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: space(4), gap: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {lines.length === 0 && (
            <View style={{ alignItems: "center", gap: space(2), paddingTop: space(6) }}>
              <Image source={FACES.happy} style={{ width: 132, height: 132 }} />
              <P faint>Tell me what you need: reminders, plans, a question. I'll remember what matters and ask before paying for anything. Browsing happens in Vyn on your computer.</P>
            </View>
          )}
          {lines.map((l, i) => (
            <View
              key={i}
              style={{
                alignSelf: l.kind === "you" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                padding: l.kind === "tool" ? 2 : 10,
                borderRadius: radius.md,
                backgroundColor: l.kind === "you" ? colors.sky : l.kind === "vyn" ? colors.bg2 : "transparent",
                borderWidth: l.kind === "vyn" ? 1 : 0,
                borderColor: colors.line,
              }}
            >
              <Text style={{ color: l.kind === "you" ? colors.onAccent : l.kind === "tool" ? colors.fg2 : colors.fg, fontSize: l.kind === "tool" ? 12 : 15 }}>{l.text}</Text>
            </View>
          ))}
          {busy && <Mono size={11}>Vyn is on it…</Mono>}
          {error && <ErrorText>{error}</ErrorText>}
        </ScrollView>
      )}

      {question && (
        <View style={{ marginHorizontal: space(4), marginBottom: space(2), padding: space(2), borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md, gap: 6 }}>
          <Text style={{ color: colors.fg }}>{question.text}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {question.choices.map((c) => (
              <Pressable key={c} onPress={() => answerRef.current?.(c)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }}>
                <Text style={{ color: colors.fg }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {!needsSetup && (
        <View style={{ flexDirection: "row", gap: 8, padding: space(4), paddingBottom: insets.bottom + space(2), borderTopWidth: 1, borderColor: colors.line }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={listening ? "Listening…" : question ? "Type your answer…" : "Talk to Vyn…"}
            placeholderTextColor={colors.fg3}
            style={{ flex: 1, color: colors.fg, backgroundColor: colors.bg2, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.line }}
            onSubmitEditing={() => (question ? (answerRef.current?.(input.trim()), setInput("")) : void send())}
            returnKeyType="send"
          />
          {stt.available() && (
            <Pressable onPress={() => void toggleMic()} accessibilityLabel={listening ? "Stop listening" : "Speak"} style={{ borderRadius: radius.md, paddingHorizontal: 10, justifyContent: "center", borderWidth: 1, borderColor: listening ? colors.accent : colors.line }}>
              <Ionicons name={listening ? "stop" : "mic"} size={20} color={listening ? colors.accent : colors.fg2} />
            </Pressable>
          )}
          <Pressable
            onPress={() => (question ? (answerRef.current?.(input.trim()), setInput("")) : void send())}
            style={{ backgroundColor: colors.sky, borderRadius: radius.md, paddingHorizontal: 14, justifyContent: "center" }}
          >
            <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
