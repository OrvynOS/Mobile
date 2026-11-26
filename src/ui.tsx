/**
 * Orvyn Mobile's component library (design direction D): flat near-black ground, rounded 24px
 * cards, pill buttons and tabs, light blue as the one brand colour, Schibsted Grotesk for text and
 * JetBrains Mono for numbers. No gradients, gold, purple or decorative stripes.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOODS, TAB_BAR_SPACE, colors, fonts, radius, space, type Mood } from "./theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Tone = "good" | "warn" | "bad" | "plain" | "accent" | "violet";

const TONES: Record<Tone, { fg: string; bg: string }> = {
  good: { fg: colors.up, bg: "rgba(74,222,128,0.14)" },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  bad: { fg: colors.down, bg: colors.downSoft },
  plain: { fg: colors.fg2, bg: colors.card2 },
  accent: { fg: colors.accent, bg: colors.accentSoft },
  violet: { fg: colors.accent, bg: colors.accentSoft },
};

export const tap = () => void Haptics.selectionAsync().catch(() => undefined);
export const success = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

// ---------------------------------------------------------------------------------------------
// Backdrop and layout
// ---------------------------------------------------------------------------------------------

/** The flat ground behind every screen. */
export function GridBackdrop() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} pointerEvents="none" />;
}

/** Fades and lifts its children in when they mount. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

export function Screen({ children, refreshing, onRefresh, tab, header }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; tab?: boolean; header?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space(4), paddingTop: header ? insets.top + space(3) : space(3), gap: space(3), paddingBottom: tab ? TAB_BAR_SPACE + insets.bottom : space(12) }}
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {header}
        <FadeIn style={{ gap: space(3) }}>{children}</FadeIn>
      </ScrollView>
    </View>
  );
}

/** The Orvyn mark: an orbit ring with a light-blue node. */
export function LogoMark({ size = 24, color = colors.fg, node = colors.accent }: { size?: number; color?: string; node?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M50.5 21.5A21 21 0 1 1 38.4 12.0" stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Circle cx={32} cy={32} r={6.5} fill={color} />
      <Circle cx={47} cy={14.5} r={5.2} fill={node} />
    </Svg>
  );
}

/** The top bar on tab screens: wordmark, how many agents are online, and actions. */
export function OsHeader({ online, right }: { online?: number; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LogoMark size={24} />
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.fg, letterSpacing: -0.7 }}>orvyn</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {online !== undefined && (
          <View style={[s.pillTag, { backgroundColor: colors.card }]}>
            <Blink color={online > 0 ? colors.up : colors.fg3} />
            <Text style={{ fontFamily: fonts.textSemi, fontSize: 12.5, color: colors.fg2 }}>{online} online</Text>
          </View>
        )}
        {right}
      </View>
    </View>
  );
}

/** Screen title for tab screens: the top bar, then a big title. */
export function LargeTitle({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={{ gap: space(4), marginBottom: space(1) }}>
      <OsHeader right={right} />
      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        {eyebrow ? <Text style={t.eyebrow}>{eyebrow}</Text> : null}
        <Text style={t.large}>{title}</Text>
      </View>
    </View>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <View style={{ gap: space(2), marginTop: space(3) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2 }}>
        <Text style={t.section}>{title}</Text>
        {action ? (
          <Text style={{ fontFamily: fonts.textSemi, fontSize: 14, color: colors.accent }} onPress={onAction}>
            {action}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A rounded surface, with an optional title row. `glow` marks the one that needs attention. */
export function Card({ children, style, glow, onPress, label, meta }: { children: ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean; onPress?: () => void; label?: string; meta?: string }) {
  const body = (
    <View style={[s.panel, glow && { borderColor: colors.accentLine }]}>
      {label ? (
        <View style={s.panelHead}>
          <Text style={{ fontFamily: fonts.textSemi, fontSize: 14, color: colors.fg2 }} numberOfLines={1}>
            {label}
          </Text>
          {meta ? <Text style={{ fontFamily: fonts.textSemi, fontSize: 12.5, color: glow ? colors.accent : colors.fg3 }}>{meta}</Text> : null}
        </View>
      ) : null}
      <View style={[{ padding: space(4), paddingTop: label ? space(2) : space(4), gap: space(2) }, style]}>{children}</View>
    </View>
  );
  return onPress ? <Press onPress={onPress}>{body}</Press> : body;
}

/** The light-blue block: the one number on a screen that matters most (totals, treasury). */
export function HeroCard({ children, style, label, meta }: { children: ReactNode; style?: StyleProp<ViewStyle>; label?: string; meta?: string }) {
  return (
    <View style={[s.panel, { backgroundColor: colors.sky, borderColor: colors.sky }]}>
      <OnSky.Provider value>
        {label ? (
          <View style={s.panelHead}>
            <Text style={{ fontFamily: fonts.textBold, fontSize: 15, color: colors.onAccent }}>{label}</Text>
            {meta ? <Text style={{ fontFamily: fonts.textSemi, fontSize: 13, color: colors.onAccent }}>{meta}</Text> : null}
          </View>
        ) : null}
        <View style={[{ padding: space(5), paddingTop: label ? space(2) : space(5), gap: space(3) }, style]}>{children}</View>
      </OnSky.Provider>
    </View>
  );
}

// Text inside the light-blue block switches to dark ink automatically.
const OnSky = createContext(false);
const useInk = (c: string | undefined, fallback: string) => {
  const onSky = useContext(OnSky);
  if (!onSky) return c ?? fallback;
  return colors.onAccent;
};

export function Divider() {
  return <View style={{ height: space(2) }} />;
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

export function Mono({ children, size = 12, color, style, onPress, numberOfLines }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; onPress?: () => void; numberOfLines?: number }) {
  const c = useInk(color, colors.fg2);
  return (
    <Text onPress={onPress} numberOfLines={numberOfLines} style={[{ fontFamily: fonts.monoMedium, fontSize: size, color: c }, style]}>
      {children}
    </Text>
  );
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useInk(undefined, colors.fg);
  return <Text style={[t.h1, { color: c }, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useInk(undefined, colors.fg);
  return <Text style={[t.h2, { color: c }, style]}>{children}</Text>;
}

export function P({ children, faint, style, selectable }: { children: ReactNode; faint?: boolean; style?: StyleProp<TextStyle>; selectable?: boolean }) {
  const onSky = useContext(OnSky);
  return (
    <Text selectable={selectable} style={[t.body, faint && t.faint, onSky && { color: colors.onAccent }, style]}>
      {children}
    </Text>
  );
}

/** Numbers: JetBrains Mono, tabular. */
export function Num({ children, size = 28, color, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const c = useInk(color, colors.fg);
  return <Text style={[{ fontFamily: fonts.monoMedium, fontSize: size, color: c, fontVariant: ["tabular-nums"], letterSpacing: -size * 0.035 }, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <View style={[s.notice, { backgroundColor: TONES.bad.bg }]}>
      <Ionicons name="alert-circle" size={17} color={colors.down} />
      <Text style={{ color: colors.down, fontFamily: fonts.textMedium, fontSize: 14, flex: 1 }}>{children}</Text>
    </View>
  );
}

export function Notice({ children, icon = "information-circle", tone = "accent" }: { children: ReactNode; icon?: IconName; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <View style={[s.notice, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={17} color={c.fg} />
      <Text style={{ color: colors.fg, fontFamily: fonts.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Live bits: status dot, clock, typewriter, meter, feed
// ---------------------------------------------------------------------------------------------

export function Blink({ color = colors.up, size = 8 }: { color?: string; size?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.35, duration: 900, useNativeDriver: true }), Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width: size, height: size, backgroundColor: color, opacity: v, borderRadius: size }} />;
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <Mono size={12} color={colors.fg3}>
      {pad(now.getHours())}:{pad(now.getMinutes())}
    </Mono>
  );
}

/** Types its text out, with a soft caret while it's going. */
export function Typewriter({ text, style, speed = 14 }: { text: string; style?: StyleProp<TextStyle>; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(id), x) : x + 2)), speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <Text style={style}>
      {text.slice(0, n)}
      {n < text.length ? <Text style={{ color: colors.accent }}>▍</Text> : null}
    </Text>
  );
}

/** A rounded progress bar. (`cells` is kept for older callers.) */
export function Meter({ value, color = colors.accent }: { value: number; cells?: number; color?: string }) {
  const onSky = useContext(OnSky);
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, borderRadius: 8, backgroundColor: onSky ? "rgba(4,18,31,0.18)" : colors.card2, overflow: "hidden", flex: 1 }}>
      <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 8, backgroundColor: onSky ? colors.onAccent : color }} />
    </View>
  );
}

const FEED_ICON: Record<string, IconName> = { think: "bulb-outline", trade: "swap-horizontal", fees: "arrow-up", bridge: "git-compare-outline", mail: "mail-outline", plugin: "extension-puzzle-outline", error: "close-circle-outline" };
const FEED_COLOR: Record<string, string> = { fees: colors.up, error: colors.down, bridge: colors.warn };

/** One line of the live feed: an icon for its kind, who, what and when. */
export function FeedLine({ at, who, kind, text, fresh }: { at: number; who: string; kind: string; text: string; fresh?: boolean }) {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "flex-start" }}>
      <View style={[s.rowIcon, { backgroundColor: colors.card2 }]}>
        <Ionicons name={FEED_ICON[kind] ?? "ellipse-outline"} size={16} color={FEED_COLOR[kind] ?? colors.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.fg, fontFamily: fonts.textMedium, fontSize: 14, lineHeight: 19 }} numberOfLines={2}>
          {text}
        </Text>
        <Mono size={11.5} color={colors.fg3}>
          {who.toLowerCase()} · {pad(d.getHours())}:{pad(d.getMinutes())}
        </Mono>
      </View>
      {fresh ? <View style={{ marginTop: 6 }}><Blink color={colors.accent} size={7} /></View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// An agent at a glance
// ---------------------------------------------------------------------------------------------

/** An agent's mood from its state and last 24h. */
export function moodOf(a: { status: string; autopilotEnabled?: boolean; held?: boolean; subscriptionActive?: boolean }, change?: number | null, hasError?: boolean): Mood {
  if (a.held || hasError || a.subscriptionActive === false) return "error";
  if (a.status !== "live") return "waiting";
  if (!a.autopilotEnabled) return "idle";
  if (change != null && change > 0.01) return "up";
  if (change != null && change < -0.01) return "down";
  return "active";
}

/**
 * An agent's avatar: a round tile with its initials and a status dot in its mood's colour. The
 * dot breathes while the agent is working.
 */
export function Orb({ symbol, mood = "active", size = 56 }: { symbol: string; mood?: Mood; size?: number }) {
  const m = MOODS[mood];
  const live = mood === "active" || mood === "up";
  const dot = Math.max(10, size * 0.24);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: mood === "active" ? colors.sky : colors.card2, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.display, fontSize: Math.max(12, size * 0.34), color: mood === "active" ? colors.onAccent : colors.fg, letterSpacing: -0.5 }}>{symbol.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ position: "absolute", right: -1, bottom: -1, width: dot + 4, height: dot + 4, borderRadius: dot, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        {live ? <Blink color={m.edge} size={dot} /> : <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: m.edge }} />}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------

/** Pressable that dips a little and ticks a haptic. */
export function Press({ children, onPress, disabled, style, haptic = true }: { children: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; haptic?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Pressable
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled || !onPress}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}>{children}</Animated.View>
    </Pressable>
  );
}

/** A pill button. Primary is light blue; secondary is a quiet surface; ghost is text only. */
export function Button({
  title,
  onPress,
  kind = "secondary",
  disabled,
  loading,
  icon,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  small?: boolean;
}) {
  const onSky = useContext(OnSky);
  const primary = kind === "primary";
  const bg = primary ? (onSky ? colors.onAccent : colors.sky) : kind === "danger" ? colors.downSoft : kind === "ghost" ? "transparent" : onSky ? "rgba(4,18,31,0.12)" : colors.control;
  const fg = primary ? (onSky ? "#FFFFFF" : colors.onAccent) : kind === "danger" ? colors.down : kind === "ghost" ? colors.accent : onSky ? colors.onAccent : colors.fg;
  return (
    <Press onPress={onPress} disabled={disabled || loading}>
      <View style={[s.button, small && { minHeight: 38, paddingHorizontal: 16 }, { backgroundColor: bg }]}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
            <Text style={[s.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
          </>
        )}
      </View>
    </Press>
  );
}

export function IconButton({ icon, onPress, badge }: { icon: IconName; onPress: () => void; badge?: number }) {
  return (
    <Press onPress={onPress}>
      <View style={s.iconButton}>
        <Ionicons name={icon} size={19} color={colors.fg} />
        {badge ? (
          <View style={s.dotBadge}>
            <Text style={{ color: colors.onAccent, fontFamily: fonts.textBold, fontSize: 11 }}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
    </Press>
  );
}

/** A small status pill: ● Live. */
export function Badge({ label, tone = "plain", dot = true }: { label: string; tone?: Tone; dot?: boolean }) {
  const c = TONES[tone];
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      {dot && <View style={{ width: 7, height: 7, backgroundColor: c.fg, borderRadius: 7 }} />}
      <Text style={{ color: c.fg, fontSize: 12.5, fontFamily: fonts.textSemi }}>{label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()}</Text>
    </View>
  );
}

/** Pill tabs; the current one is white. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} style={{ flex: 1 }} onPress={() => (tap(), onChange(o.value))}>
            <View style={[s.segment, active && s.segmentActive]}>
              <Text style={{ color: active ? colors.onInverse : colors.fg2, fontFamily: fonts.textSemi, fontSize: 14 }}>
                {o.label}
                {o.count ? <Text style={{ color: active ? colors.onInverse : colors.accent }}> {o.count}</Text> : null}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      onValueChange={(v) => (tap(), onChange(v))}
      disabled={disabled}
      trackColor={{ true: colors.sky, false: colors.card3 }}
      thumbColor={value ? colors.onAccent : colors.fg3}
      ios_backgroundColor={colors.card3}
    />
  );
}

export function Field(props: TextInputProps & { label: string; hint?: string }) {
  const { label, hint, style, ...input } = props;
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.textSemi, fontSize: 13.5, color: focus ? colors.accent : colors.fg2, paddingHorizontal: 2 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.fg3}
        selectionColor={colors.accent}
        onFocus={(e) => (setFocus(true), input.onFocus?.(e))}
        onBlur={(e) => (setFocus(false), input.onBlur?.(e))}
        style={[s.input, focus && { borderColor: colors.accent }, input.multiline && { minHeight: 110, textAlignVertical: "top", paddingTop: 14, borderRadius: radius.md }, style]}
        {...input}
      />
      {hint ? <Text style={t.hint}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------------------------

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  const onSky = useContext(OnSky);
  return (
    <View style={[s.stat, onSky && { backgroundColor: "rgba(255,255,255,0.45)" }]}>
      <Text style={{ fontFamily: fonts.textMedium, fontSize: 12.5, color: onSky ? colors.onAccent : colors.fg3 }}>{label}</Text>
      <Num size={18} color={tone === "up" ? colors.up : tone === "down" ? colors.down : undefined}>
        {value}
      </Num>
      {sub ? <Mono size={11} color={colors.fg3}>{sub}</Mono> : null}
    </View>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>{children}</View>;
}

/** List row: leading icon, orb or avatar, title, subtitle, trailing content, a chevron when tappable. */
export function Row({
  title,
  subtitle,
  right,
  left,
  icon,
  iconTone = "plain",
  onPress,
  unread,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  icon?: IconName;
  iconTone?: Tone;
  onPress?: () => void;
  unread?: boolean;
  last?: boolean;
}) {
  const body = (
    <View style={s.row}>
      {unread !== undefined && <View style={{ width: 8, height: 8, backgroundColor: unread ? colors.accent : "transparent", marginRight: -4, borderRadius: 8 }} />}
      {left}
      {icon ? (
        <View style={[s.rowIcon, { backgroundColor: TONES[iconTone].bg }]}>
          <Ionicons name={icon} size={17} color={iconTone === "plain" ? colors.fg : TONES[iconTone].fg} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[t.rowTitle, unread && { fontFamily: fonts.textBold }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={t.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={17} color={colors.fg3} /> : null}
    </View>
  );
  return onPress ? <Press onPress={onPress}>{body}</Press> : body;
}

export function ToggleRow({ title, subtitle, value, onChange, icon, disabled, last }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; disabled?: boolean; last?: boolean }) {
  return <Row title={title} subtitle={subtitle} icon={icon} last={last} right={<Toggle value={value} onChange={onChange} disabled={disabled} />} />;
}

/** A person (sender, client): a round monogram. */
export function Avatar({ icon, symbol, size = 40 }: { icon: string | null; symbol: string; size?: number; ring?: boolean }) {
  if (icon) return <Image source={{ uri: icon }} style={{ width: size, height: size, borderRadius: size }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: size * 0.36 }}>{symbol.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

/** A small price line. */
export function Sparkline({ data, width = 120, height = 40, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 4 - ((v - min) / span) * (height - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const stroke = color ?? (up ? colors.accent : colors.down);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={line} stroke={stroke} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lx} cy={ly} r={3} fill={stroke} />
    </Svg>
  );
}

export function Empty({ title, children, icon = "sparkles-outline" }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.onAccent} />
      </View>
      <Text style={{ fontFamily: fonts.textBold, fontSize: 16, color: colors.fg, textAlign: "center" }}>{title}</Text>
      {children}
    </View>
  );
}

/** Soft placeholder blocks while a screen loads. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.9, duration: 700, useNativeDriver: true }), Animated.timing(v, { toValue: 0.4, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ gap: space(3) }}>
      {Array.from({ length: lines }, (_, i) => (
        <Animated.View key={i} style={{ opacity: v, height: i === 0 ? 140 : 76, borderRadius: radius.lg, backgroundColor: colors.card }} />
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** A message: mine on the right in light blue, theirs on the left, system lines centred. */
export function Bubble({ text, meta, side }: { text: string; meta: string; side: "me" | "them" | "system" }) {
  if (side === "system") {
    return (
      <View style={{ alignItems: "center", marginVertical: 2 }}>
        <Text style={{ fontFamily: fonts.textSemi, fontSize: 12, color: colors.fg3, textAlign: "center" }}>{text}</Text>
      </View>
    );
  }
  const me = side === "me";
  return (
    <View style={{ alignItems: me ? "flex-end" : "flex-start", gap: 4 }}>
      <View style={[s.bubble, me ? s.bubbleMe : s.bubbleThem]}>
        <Text selectable style={{ color: me ? colors.onAccent : colors.fg, fontFamily: fonts.text, fontSize: 15.5, lineHeight: 22 }}>
          {text}
        </Text>
      </View>
      <Mono size={10.5} color={colors.fg3} style={{ marginHorizontal: 6 }}>
        {meta}
      </Mono>
    </View>
  );
}

export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <View style={[s.notice, { backgroundColor: colors.accentSoft }]}>
      <Ionicons name="flask-outline" size={17} color={colors.accent} />
      <Text style={{ color: colors.fg, fontFamily: fonts.textMedium, fontSize: 13.5, flex: 1 }}>Demo: sample data, nothing is real.</Text>
      <Text style={{ color: colors.accent, fontFamily: fonts.textBold, fontSize: 13.5 }} onPress={onExit}>
        Exit
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------------------------

export const t = StyleSheet.create({
  eyebrow: { color: colors.fg3, fontFamily: fonts.textSemi, fontSize: 14 },
  large: { color: colors.fg, fontFamily: fonts.display, fontSize: 36, letterSpacing: -1.4, lineHeight: 40 },
  h1: { color: colors.fg, fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.9, lineHeight: 32 },
  h2: { color: colors.fg, fontFamily: fonts.displaySemi, fontSize: 18, letterSpacing: -0.3 },
  section: { color: colors.fg, fontFamily: fonts.displaySemi, fontSize: 19, letterSpacing: -0.4 },
  body: { color: colors.fg2, fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
  faint: { color: colors.fg3, fontSize: 13.5, lineHeight: 19 },
  label: { color: colors.fg3, fontFamily: fonts.textSemi, fontSize: 12.5 },
  hint: { color: colors.fg3, fontFamily: fonts.text, fontSize: 12.5, paddingHorizontal: 2 },
  rowTitle: { color: colors.fg, fontFamily: fonts.textSemi, fontSize: 16 },
  rowSub: { color: colors.fg3, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19 },
  mono: { color: colors.fg, fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
});

const s = StyleSheet.create({
  panel: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: "transparent", backgroundColor: colors.card, overflow: "hidden" },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, paddingHorizontal: space(4), paddingTop: space(4) },
  pillTag: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill },
  button: { minHeight: 50, borderRadius: radius.pill, paddingHorizontal: 22, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.textBold, fontSize: 15.5 },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  dotBadge: { position: "absolute", top: -3, right: -3, minWidth: 19, height: 19, borderRadius: 19, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, height: 26, alignSelf: "flex-start" },
  segmented: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.card },
  segment: { height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.inverse },
  input: { backgroundColor: colors.control, color: colors.fg, borderColor: "transparent", borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 13, fontSize: 16, fontFamily: fonts.text },
  stat: { flexGrow: 1, flexBasis: "45%", padding: 12, gap: 2, borderRadius: radius.md, backgroundColor: colors.card2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, paddingVertical: 32, paddingHorizontal: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 56, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  bubble: { maxWidth: "86%", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 },
  bubbleMe: { backgroundColor: colors.sky, borderBottomRightRadius: 6 },
  bubbleThem: { backgroundColor: colors.card2, borderBottomLeftRadius: 6 },
});

export const styles = { body: t.mono };
