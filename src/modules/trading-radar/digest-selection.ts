type DigestSelectablePost = {
  creatorId: string;
  publishedAt: Date;
  readAt: Date | null;
};

export function selectPostsForDigest<T extends DigestSelectablePost>(posts: T[], creatorIds: string[], limit = 10) {
  const selectedCreators = new Set(creatorIds);

  return posts
    .filter((post) => selectedCreators.has(post.creatorId) && post.readAt === null)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}
