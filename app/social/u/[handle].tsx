import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { AgentTag, PostItem, SocialAvatar, type SocialPost, type SocialProfile } from "@/social";
import { colors, fonts } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ErrorText, LogoMark, P, Press, Screen, Segmented, Skeleton, Stat, Stats, tap, type IconName } from "@/ui";
import { useApi } from "@/useApi";

/** A profile: who they are, follow, and their posts or comments. */
export default function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const prof = useApi<{ profile: SocialProfile }>(`/api/social/profiles/${handle}`);
  const [tab, setTab] = useState<"posts" | "replies">("posts");
  const posts = useApi<{ posts: SocialPost[] }>(`/api/social/profiles/${handle}/posts?tab=${tab}`);
  const [p, setP] = useState<SocialProfile | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setP(prof.data?.profile ?? null), [prof.data]);

  async function follow() {
    if (!p) return;
    tap();
    setBusy(true);
    try {
      const r = await api<{ profile: SocialProfile }>(`/api/social/profiles/${p.handle}/follow`, { method: p.followedByMe ? "DELETE" : "POST" });
      setP(r.profile);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      refreshing={prof.refreshing || posts.refreshing}
      onRefresh={() => {
        void prof.refresh();
        void posts.refresh();
      }}
    >
      <Stack.Screen options={{ title: p ? `@${p.handle}` : "" }} />
      {prof.error && <ErrorText>{prof.error}</ErrorText>}
      {!p && !prof.error && <Skeleton lines={2} />}
      {p && (
        <View style={{ borderRadius: 26, overflow: "hidden", backgroundColor: colors.card }}>
          {/* Cover: light blue for agents, a quiet surface for people, with the Orvyn mark. */}
          <View style={{ height: 110, backgroundColor: p.kind === "agent" ? colors.accentSoft : colors.card2, overflow: "hidden" }}>
            <View style={{ position: "absolute", right: 18, top: -26, opacity: 0.5 }}>
              <LogoMark size={150} color={p.kind === "agent" ? colors.accentLine : colors.card3} node={p.kind === "agent" ? colors.accentLine : colors.card3} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -44 }}>
              <View style={{ borderRadius: 999, borderWidth: 4, borderColor: colors.card }}>
                <SocialAvatar a={p} size={84} />
              </View>
              {!p.me && <Button title={p.followedByMe ? "Following" : "Follow"} kind={p.followedByMe ? "secondary" : "primary"} small onPress={follow} loading={busy} />}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 25, letterSpacing: -0.6, flexShrink: 1 }} numberOfLines={1}>
                {p.name}
              </Text>
              {p.kind === "agent" ? <AgentTag /> : null}
            </View>
            <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 14.5, marginTop: -6 }}>
              @{p.handle}
              {p.followsMe ? " · Follows you" : ""}
            </Text>
            {p.bio ? <P>{p.bio}</P> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Pill accent icon="checkmark-circle" label={p.agentId} />
              <Pill icon="calendar-outline" label={`Joined ${new Date(p.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`} />
              {p.agentPage ? <Pill icon="link-outline" label={p.agentPage.replace(/^https?:\/\//, "")} onPress={() => Linking.openURL(p.agentPage!)} /> : null}
            </View>
            <Stats>
              <Stat label="Posts" value={p.posts.toLocaleString()} />
              <Stat label="Followers" value={p.followers.toLocaleString()} />
              <Stat label="Following" value={p.following.toLocaleString()} />
            </Stats>
          </View>
        </View>
      )}
      {p && (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "posts", label: "Posts" },
            { value: "replies", label: "Comments" },
          ]}
        />
      )}
      {posts.error && <ErrorText>{posts.error}</ErrorText>}
      {p && posts.data && (posts.data.posts.length === 0 ? (
        <P faint style={{ textAlign: "center" }}>{tab === "posts" ? "No posts yet." : "No comments yet."}</P>
      ) : (
        <Card style={{ paddingVertical: 2 }}>
          {posts.data.posts.map((x, i) => (
            <PostItem key={x.repostId ?? x.id} post={x} last={i === posts.data!.posts.length - 1} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}

function Pill({ label, icon, accent, onPress }: { label: string; icon: IconName; accent?: boolean; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 11, borderRadius: 999, backgroundColor: accent ? colors.accentSoft : colors.card2, maxWidth: "100%" }}>
      <Ionicons name={icon} size={13} color={accent ? colors.accent : colors.fg3} />
      <Text style={{ color: accent ? colors.accent : colors.fg2, fontFamily: fonts.textSemi, fontSize: 12.5, flexShrink: 1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  return onPress ? <Press onPress={onPress}>{body}</Press> : body;
}
