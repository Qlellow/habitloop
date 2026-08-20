import { CheckInsService } from './checkins.service';

describe('CheckInsService.streak', () => {
  function makeService(dates: string[]) {
    const repo = {
      find: jest.fn().mockResolvedValue(dates.map((date) => ({ date }))),
    } as any;
    return new CheckInsService(repo, {} as any);
  }

  it('returns 0 with no check-ins', async () => {
    const service = makeService([]);
    expect(await service.streak(1)).toBe(0);
  });

  it('counts consecutive days ending today', async () => {
    const today = new Date();
    const d0 = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const d1 = yesterday.toISOString().slice(0, 10);

    const service = makeService([d0, d1]);
    expect(await service.streak(1)).toBe(2);
  });

  it('stops streak at first gap', async () => {
    const today = new Date();
    const d0 = today.toISOString().slice(0, 10);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    const d2 = twoDaysAgo.toISOString().slice(0, 10);

    const service = makeService([d0, d2]);
    expect(await service.streak(1)).toBe(1);
  });
});
