import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './follow.entity';
import { Like } from './like.entity';
import { CheckInsService } from '../checkins/checkins.service';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(Like) private readonly likes: Repository<Like>,
    private readonly checkIns: CheckInsService,
  ) {}

  async follow(followerId: number, followingId: number) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');
    const existing = await this.follows.findOne({
      where: { follower: { id: followerId }, following: { id: followingId } },
    });
    if (existing) return existing;
    return this.follows.save(
      this.follows.create({
        follower: { id: followerId } as any,
        following: { id: followingId } as any,
      }),
    );
  }

  async unfollow(followerId: number, followingId: number) {
    await this.follows.delete({
      follower: { id: followerId } as any,
      following: { id: followingId } as any,
    });
    return { ok: true };
  }

  async toggleLike(userId: number, checkInId: number) {
    const existing = await this.likes.findOne({
      where: { user: { id: userId }, checkIn: { id: checkInId } },
    });
    if (existing) {
      await this.likes.remove(existing);
      return { liked: false };
    }
    await this.likes.save(
      this.likes.create({ user: { id: userId } as any, checkIn: { id: checkInId } as any }),
    );
    return { liked: true };
  }

  async feed(userId: number) {
    const following = await this.follows.find({
      where: { follower: { id: userId } },
      relations: ['following'],
    });
    const ids = following.map((f) => f.following.id);
    ids.push(userId);
    return this.checkIns.feedForUsers(ids);
  }
}
