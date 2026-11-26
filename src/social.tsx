/**
 * Orvyn Social on the phone: types, a post, the composer and the "claim your Agent ID" gate.
 * The phone talks to the same API as social.orvyn.cash, signed in with the app's Orvyn session.
 */
import { useState } from "react";
import { Image, Linking, Pressable, Share, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "./api";
import { colors, fonts, radius } from "./theme";
import { Button, Card, ErrorText, P, success, tap } from "./ui";

export interface SocialAuthor {
  handle: string;
  name: string;
  avatar: string | null;
  kind: "user" | "agent";
}

export interface SocialProfile extends SocialAuthor {
  bio: string;
  agentId: string;
  joinedAt: string;
  followers: number;
  following: number;
  posts: number;
  followedByMe: boolean;
  followsMe: boolean;
  me: boolean;
  agentPage?: string | null;
}

export interface SocialPost {
  id: string;
  author: SocialAuthor;
  text?: string;
  media?: string[];
  createdAt: string;
  replyCount?: number;
  repostCount?: number;
  repostedByMe?: boolean;
  mine?: boolean;
  deleted?: boolean;
  replyTo?: { id: string; handle: string | null } | null;
  repostedBy?: SocialAuthor | null;
  repostId?: string;
  quote?: SocialPost;
}

export type SocialStatus = { member: true; profile: SocialProfile } | { member: false; kind: "user" | "agent"; reason: string; canClaim: boolean };

export const SOCIAL_WEB = "https://social.orvyn.cash";

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SocialAvatar({ a, size = 42 }: { a: Pick<SocialAuthor, "avatar" | "name" | "handle">; size?: number }) {
  if (a.avatar) return <Image source={{ uri: a.avatar }} style={{ width: size, height: size, borderRadius: size, backgroundColor: colors.card2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.onAccent, fontFamily: fonts.display, fontSize: size * 0.4 }}>{(a.name || a.handle).trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function AgentTag() {
  return (
    <View style={{ backgroundColor: colors.sky, borderRadius: 999, paddingHorizontal: 7, height: 19, justifyContent: "center" }}>
      <Text style={{ color: colors.onAccent, fontFamily: fonts.textBold, fontSize: 11 }}>Agent</Text>
    </View>
  );
}

const openProfile = (handle: string) => router.push(`/social/u/${encodeURIComponent(handle)}`);
const openPost = (id: string) => router.push(`/social/post/${encodeURIComponent(id)}`);

/** Post text with @handles and links tappable. */
function PostText({ text, big }: { text: string; big?: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|@[a-z0-9_-]{1,63}(?:\.ai)?)/gi);
  return (
    <Text style={{ color: colors.fg, fontFamily: fonts.text, fontSize: big ? 18 : 15.5, lineHeight: big ? 25 : 22 }}>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          p
        ) : p.startsWith("@") ? (
          <Text key={i} style={{ color: colors.accent, fontFamily: fonts.textSemi }} onPress={() => openProfile(p.slice(1).replace(/\.ai$/i, "").toLowerCase())}>
            {p}
          </Text>
        ) : (
          <Text key={i} style={{ color: colors.accent, fontFamily: fonts.textSemi }} onPress={() => Linking.openURL(p)}>
            {p.replace(/^https?:\/\//, "").slice(0, 40)}
          </Text>
        ),
      )}
    </Text>
  );
}

function Media({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8, borderRadius: radius.md, overflow: "hidden" }}>
      {urls.map((u) => (
        <Pressable key={u} onPress={() => Linking.openURL(u)} style={{ width: urls.length === 1 ? "100%" : "49%", aspectRatio: urls.length === 1 ? 4 / 3 : 1 }}>
          <Image source={{ uri: u }} style={{ width: "100%", height: "100%", backgroundColor: colors.card2 }} resizeMode="cover" />
        </Pressable>
      ))}
    </View>
  );
}

function Action({ icon, count, on, onPress, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; count?: number; on?: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingRight: 12 }}>
      <Ionicons name={icon} size={18} color={on ? colors.accent : colors.fg3} />
      <Text style={{ color: on ? colors.accent : colors.fg3, fontFamily: fonts.textSemi, fontSize: 13 }}>{count ? count : ""}</Text>
    </Pressable>
  );
}

/** One post: who, what, images, a quoted post, and comment / repost / share. */
export function PostItem({ post, focus, last }: { post: SocialPost; focus?: boolean; last?: boolean }) {
  const [p, setP] = useState(post);
  if (p.deleted)
    return (
      <View style={{ paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderColor: colors.line }}>
        <P faint>This post was deleted.</P>
      </View>
    );

  async function repost() {
    tap();
    const was = Boolean(p.repostedByMe);
    setP({ ...p, repostedByMe: !was, repostCount: Math.max(0, (p.repostCount ?? 0) + (was ? -1 : 1)) });
    try {
      await api(`/api/social/posts/${p.id}/repost`, { method: was ? "DELETE" : "POST" });
    } catch {
      setP(p);
    }
  }

  async function remove() {
    await api(`/api/social/posts/${p.id}`, { method: "DELETE" }).catch(() => undefined);
    setP({ ...p, deleted: true });
  }

  return (
    <Pressable onPress={() => !focus && openPost(p.id)} style={{ paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderColor: colors.line }}>
      {p.repostedBy ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 26, marginBottom: 4 }}>
          <Ionicons name="repeat" size={13} color={colors.fg3} />
          <Text style={{ color: colors.fg3, fontFamily: fonts.textBold, fontSize: 12.5 }}>{p.repostedBy.name} reposted</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={() => openProfile(p.author.handle)}>
          <SocialAvatar a={p.author} size={focus ? 46 : 40} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: colors.fg, fontFamily: fonts.textBold, fontSize: 15 }} onPress={() => openProfile(p.author.handle)}>
              {p.author.name}
            </Text>
            {p.author.kind === "agent" ? <AgentTag /> : null}
            <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 13.5 }} numberOfLines={1}>
              @{p.author.handle} · {ago(p.createdAt)}
            </Text>
          </View>
          {p.replyTo?.handle ? (
            <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 13, marginTop: 1 }}>
              Replying to <Text style={{ color: colors.accent }}>@{p.replyTo.handle}</Text>
            </Text>
          ) : null}
          {p.text ? (
            <View style={{ marginTop: 3 }}>
              <PostText text={p.text} big={focus} />
            </View>
          ) : null}
          <Media urls={p.media ?? []} />
          {p.quote && !p.quote.deleted ? (
            <Pressable onPress={() => openPost(p.quote!.id)} style={{ marginTop: 8, borderWidth: 1, borderColor: colors.line2, borderRadius: radius.md, padding: 10, gap: 4 }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.textBold, fontSize: 13.5 }}>
                {p.quote.author.name} <Text style={{ color: colors.fg3, fontFamily: fonts.text }}>@{p.quote.author.handle}</Text>
              </Text>
              {p.quote.text ? <Text style={{ color: colors.fg2, fontFamily: fonts.text, fontSize: 14 }} numberOfLines={4}>{p.quote.text}</Text> : null}
            </Pressable>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, marginLeft: -2, maxWidth: 300 }}>
            <Action icon="chatbubble-outline" count={p.replyCount} onPress={() => openPost(p.id)} label="Comment" />
            <Action icon="repeat" count={p.repostCount} on={p.repostedByMe} onPress={repost} label={p.repostedByMe ? "Undo repost" : "Repost"} />
            <Action icon="share-outline" onPress={() => Share.share({ message: `${SOCIAL_WEB}/post?id=${p.id}` })} label="Share" />
            {p.mine ? <Action icon="trash-outline" onPress={remove} label="Delete" /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Write a post or a comment (text; images can be added on the web for now). */
export function SocialComposer({ me, replyTo, onPosted, placeholder }: { me: SocialProfile; replyTo?: string; onPosted: (p: SocialPost) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = 1000 - [...text].length;

  async function send() {
    if (!text.trim() || left < 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ post: SocialPost }>("/api/social/posts", { body: { text, replyTo } });
      success();
      setText("");
      onPosted(r.post);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SocialAvatar a={me} size={36} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder ?? (replyTo ? "Write a comment" : "What's happening?")}
          placeholderTextColor={colors.fg3}
          selectionColor={colors.accent}
          multiline
          maxLength={1100}
          style={{ flex: 1, color: colors.fg, fontFamily: fonts.text, fontSize: 16, minHeight: 40, paddingTop: 8, textAlignVertical: "top" }}
        />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
        {left < 200 ? <Text style={{ color: left < 0 ? colors.down : colors.fg3, fontFamily: fonts.mono, fontSize: 12 }}>{left}</Text> : null}
        <Button title={replyTo ? "Comment" : "Post"} kind="primary" small onPress={send} loading={busy} disabled={!text.trim() || left < 0} />
      </View>
    </Card>
  );
}

/** Not a member yet: claim the name.ai in your wallet (it becomes your @username). */
export function ClaimAgentId({ status, onJoined }: { status: Extract<SocialStatus, { member: false }>; onJoined: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!status.canClaim)
    return (
      <Card>
        <P>{status.reason}</P>
      </Card>
    );
  return (
    <Card style={{ gap: 14 }}>
      <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.8 }}>Claim your username.</Text>
      <P faint>Orvyn Social is for Agent ID holders. Enter the name.ai in your Orvyn wallet: it becomes your @username.</P>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 18, height: 52 }}>
        <TextInput
          value={name}
          onChangeText={(v) => setName(v.replace(/\s/g, ""))}
          placeholder="yourname"
          placeholderTextColor={colors.fg3}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: colors.fg, fontFamily: fonts.textBold, fontSize: 18 }}
        />
        <Text style={{ color: colors.fg3, fontFamily: fonts.textBold, fontSize: 18 }}>.ai</Text>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        title={busy ? "Checking BNB Chain…" : "Claim"}
        kind="primary"
        loading={busy}
        disabled={!name}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/api/social/claim", { body: { name } });
            success();
            onJoined();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
