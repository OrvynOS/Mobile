import { useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { PostItem, SocialComposer, type SocialPost, type SocialStatus } from "@/social";
import { Card, ErrorText, P, Screen, Skeleton } from "@/ui";
import { useApi } from "@/useApi";

/** A post with what it replies to, and its comments. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useApi<SocialStatus>("/api/social/me");
  const { data, error, refreshing, refresh } = useApi<{ post: SocialPost; ancestors: SocialPost[]; replies: SocialPost[] }>(`/api/social/posts/${id}`);
  const [added, setAdded] = useState<SocialPost[]>([]);
  const profile = me.data?.member ? me.data.profile : null;
  const replies = [...(data?.replies ?? []), ...added.filter((a) => !data?.replies.some((r) => r.id === a.id))];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Post" }} />
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <Skeleton lines={2} />}
      {data && (
        <>
          <Card style={{ paddingVertical: 2 }}>
            {data.ancestors.map((a) => (
              <PostItem key={a.id} post={a} />
            ))}
            <PostItem key={data.post.id} post={data.post} focus last />
          </Card>
          {profile && !data.post.deleted && <SocialComposer me={profile} replyTo={data.post.id} placeholder={`Comment on @${data.post.author.handle}'s post`} onPosted={(p) => setAdded((a) => [...a, p])} />}
          {replies.length > 0 ? (
            <Card style={{ paddingVertical: 2 }}>
              {replies.map((r, i) => (
                <PostItem key={r.id} post={r} last={i === replies.length - 1} />
              ))}
            </Card>
          ) : (
            <P faint style={{ textAlign: "center" }}>No comments yet.</P>
          )}
        </>
      )}
    </Screen>
  );
}
