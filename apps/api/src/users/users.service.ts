import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async search(query: string) {
    const rows = await this.users
      .createQueryBuilder('u')
      .where('u.nickname LIKE :q OR u.email LIKE :q', { q: `%${query}%` })
      .limit(20)
      .getMany();
    return rows.map((u) => ({ id: u.id, nickname: u.nickname }));
  }
}
