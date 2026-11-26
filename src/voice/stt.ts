/**
 * Speech to text, on the device. Uses expo-speech-recognition, which is a native module: it
 * works in a dev or store build, but Expo Go doesn't include it, so it's loaded lazily and
 * `available()` is false there (the voice screen then offers typing and tap-to-run instead).
 */

import { requireOptionalNativeModule } from "expo";

type Sub = { remove(): void };
interface Native {
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  addListener(event: string, fn: (e: any) => void): Sub;
}

let mod: Native | null | undefined;

function native(): Native | null {
  if (mod !== undefined) return mod;
  // Check first: loading the package without its native half logs a red error even when caught.
  if (!requireOptionalNativeModule("ExpoSpeechRecognition")) return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-speech-recognition").ExpoSpeechRecognitionModule as Native;
  } catch {
    mod = null;
  }
  return mod;
}

/** True when this build can listen. */
export function available(): boolean {
  const m = native();
  if (!m) return false;
  try {
    return m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export interface ListenHandlers {
  /** Live words as they're recognised, then the final text. */
  onText(text: string, final: boolean): void;
  onEnd(): void;
  onError(message: string): void;
}

/** Start listening. Returns a function that stops it (keeping what was heard so far). */
export async function listen(h: ListenHandlers): Promise<() => void> {
  const m = native();
  if (!m) throw new Error("Voice input needs the Orvyn app build. In Expo Go, type or tap a command.");
  const perm = await m.requestPermissionsAsync();
  if (!perm.granted) throw new Error("Orvyn needs microphone and speech permission to hear you. You can turn it on in Settings.");

  const subs: Sub[] = [];
  const done = () => subs.splice(0).forEach((s) => s.remove());
  subs.push(
    m.addListener("result", (e: { isFinal: boolean; results: { transcript: string }[] }) => {
      const text = e.results?.[0]?.transcript ?? "";
      if (text) h.onText(text, e.isFinal);
    }),
    m.addListener("error", (e: { error: string; message: string }) => {
      done();
      // "no-speech" and "aborted" just mean nothing was said: not worth an error.
      if (e.error === "no-speech" || e.error === "aborted") h.onEnd();
      else h.onError(e.message || "Couldn't hear that. Try again.");
    }),
    m.addListener("end", () => {
      done();
      h.onEnd();
    }),
  );

  m.start({ lang: "en-US", interimResults: true, continuous: false, addsPunctuation: true });
  return () => {
    try {
      m.stop();
    } catch {
      /* already stopped */
    }
  };
}

export function cancel() {
  try {
    native()?.abort();
  } catch {
    /* nothing running */
  }
}
