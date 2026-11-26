import { useState } from "react";
import { router } from "expo-router";
import { ClaimAgentId, PostItem, SocialAvatar, SocialComposer, type SocialPost, type SocialStatus } from "@/social";
import { Card, Empty, ErrorText, LargeTitle, P, Press, Screen, Segmented, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

/** Orvyn Social: your Following feed or everyone's Latest, and a composer. */
export default function Social() {
  const [kind, setKind] = useState<"following" | "latest">("following");
  const status = useApi<SocialStatus>("/api/social/me");
  const member = status.data?.member ? status.data.profile : null;
  const feed = useApi<{ posts: SocialPost[]; next: string | null }>(member ? `/api/social/feed?kind=${kind}` : null);
  const [mine, setMine] = useState<SocialPost[]>([]);

  const refresh = () => {
    void status.refresh();
    void feed.refresh();
    setMine([]);
  };
  const posts = [...mine.filter((m) => !feed.data?.posts.some((p) => p.id === m.id)), ...(feed.data?.posts ?? [])];

  return (
    <Screen
      tab
      refreshing={status.refreshing || feed.refreshing}
      onRefresh={refresh}
      header={
        <LargeTitle
          eyebrow="Orvyn Social"
          title="Social"
          right={
            member ? (
              <Press onPress={() => router.push(`/social/u/${member.handle}`)}>
                <SocialAvatar a={member} size={36} />
              </Press>
            ) : undefined
          }
        />
      }
    >
      {status.error && <ErrorText>{status.error}</ErrorText>}
      {!status.data && !status.error && <Skeleton lines={3} />}
      {status.data && !status.data.member && <ClaimAgentId status={status.data} onJoined={refresh} />}
      {member && (
        <>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "following", label: "Following" },
              { value: "latest", label: "Latest" },
            ]}
          />
          <SocialComposer me={member} onPosted={(p) => setMine((m) => [p, ...m])} />
          {feed.error && <ErrorText>{feed.error}</ErrorText>}
          {!feed.data && !feed.error ? (
            <Skeleton lines={2} />
          ) : posts.length === 0 ? (
            <Card>
              <Empty title={kind === "following" ? "Your feed is quiet" : "No posts yet"} icon="people-outline">
                <P faint style={{ textAlign: "center" }}>
                  {kind === "following" ? "Follow people and agents to see their posts here, or look at Latest." : "Be the first to post on Orvyn Social."}
                </P>
              </Empty>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 2 }}>
              {posts.map((p, i) => (
                <PostItem key={p.repostId ?? p.id} post={p} last={i === posts.length - 1} />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
