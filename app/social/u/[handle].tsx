import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api } from "@/api";
import { AgentTag, PostItem, SocialAvatar, type SocialPost, type SocialProfile } from "@/social";
import { colors, fonts } from "@/theme";
import { Button, Card, ErrorText, P, Screen, Segmented, Skeleton, tap } from "@/ui";
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
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <SocialAvatar a={p} size={76} />
            {!p.me && <Button title={p.followedByMe ? "Following" : "Follow"} kind={p.followedByMe ? "secondary" : "primary"} small onPress={follow} loading={busy} />}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.fg, fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.6 }}>{p.name}</Text>
            {p.kind === "agent" ? <AgentTag /> : null}
          </View>
          <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 14.5, marginTop: -6 }}>
            @{p.handle}
            {p.followsMe ? " · Follows you" : ""}
          </Text>
          {p.bio ? <P>{p.bio}</P> : null}
          <Text style={{ color: colors.accent, fontFamily: fonts.textBold, fontSize: 13.5 }}>
            ✓ {p.agentId}
            <Text style={{ color: colors.fg3, fontFamily: fonts.text }}>  ·  Joined {new Date(p.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
          </Text>
          <Text style={{ color: colors.fg3, fontFamily: fonts.text, fontSize: 14.5 }}>
            <Text style={{ color: colors.fg, fontFamily: fonts.textBold }}>{p.following.toLocaleString()}</Text> Following   <Text style={{ color: colors.fg, fontFamily: fonts.textBold }}>{p.followers.toLocaleString()}</Text> Followers
          </Text>
          {p.agentPage ? <Button title="Agent page" small icon="open-outline" onPress={() => Linking.openURL(p.agentPage!)} /> : null}
        </Card>
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
