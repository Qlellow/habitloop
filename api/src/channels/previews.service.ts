import { Injectable } from '@nestjs/common';
import { clamp } from '../common/cursor-page';
import { PostsService, type PostSummary } from '../posts/posts.service';
import { ChannelsService } from './channels.service';
import { MembershipService } from './membership.service';

export const MAX_POSTS_PER_CHANNEL = 8;

/** 채널 목록 + 채널별 최근 글 미리보기. 채널 수와 상관없이 쿼리 수가 일정하다 (채널 목록, 가입 여부, 최근 글). */
@Injectable()
export class PreviewsService {
  constructor(
    private readonly channels: ChannelsService,
    private readonly membership: MembershipService,
    private readonly posts: PostsService,
  ) {}

  async previews(keyword: string | undefined, postsPerChannel: number, viewerId?: number) {
    const perChannel = clamp(postsPerChannel, 0, MAX_POSTS_PER_CHANNEL);
    // 인기 채널 목록은 캐시되어 있어 대부분 DB 를 타지 않는다
    const adult = await this.channels.isAdult(viewerId);
    const list = keyword?.trim() ? await this.channels.search(keyword, adult) : await this.channels.popular(adult);
    const ids = list.map((c) => c.id);
    const [joined, recent] = await Promise.all([
      this.membership.joinedAmong(viewerId, ids),
      this.posts.recentByChannels(ids, perChannel, adult),
    ]);
    const byChannel = new Map<string, PostSummary[]>();
    for (const post of recent) {
      const bucket = byChannel.get(post.channelSlug) ?? [];
      bucket.push(post);
      byChannel.set(post.channelSlug, bucket);
    }
    return list.map((c) => ({ ...c, joined: joined.has(c.id), recentPosts: byChannel.get(c.slug) ?? [] }));
  }
}
