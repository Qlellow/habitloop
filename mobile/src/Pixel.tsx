import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { PET_GRID, VILLAGE_COLORS, VILLAGE_LOTS, petRects, villageSprite, type PetPublic, type Village, type VillageSpriteName } from '@loop/shared';
import { useScheme } from './theme';

/**
 * 도트(픽셀) 그림. 같은 색이 이어지는 가로 칸 하나를 View 하나로 그린다.
 * 칸 크기가 정수가 아니어도 틈이 생기지 않게 칸 경계를 반올림한다.
 */
type Run = { x: number; y: number; w: number; h?: number; c: string };

function Runs({ runs, scale, dx = 0, dy = 0 }: { runs: Run[]; scale: number; dx?: number; dy?: number }) {
  return (
    <>
      {runs.map((r, i) => {
        const left = Math.round((dx + r.x) * scale);
        const top = Math.round((dy + r.y) * scale);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              width: Math.round((dx + r.x + r.w) * scale) - left,
              height: Math.round((dy + r.y + (r.h ?? 1)) * scale) - top,
              backgroundColor: r.c,
            }}
          />
        );
      })}
    </>
  );
}

/* ───────── 펫 ───────── */

const isNight = () => {
  const h = (new Date().getUTCHours() + 9) % 24;
  return h >= 23 || h < 6;
};

/**
 * 살아 있는 펫: 깜빡이고, 통통 뛰고, 졸리거나 밤(23~6시)이면 잔다.
 * pats 가 바뀌면(쓰다듬으면) 펄쩍 뛰며 하트가 뜬다
 */
export const PetView = memo(function PetView({ pet, size = 6, progress = 0, pats = 0, onPress }: { pet: PetPublic; size?: number; progress?: number; pats?: number; onPress?: () => void }) {
  const [blink, setBlink] = useState(false);
  const [hearts, setHearts] = useState(0);
  const hop = useRef(new Animated.Value(0)).current;
  const sleeping = pet.stage !== 'egg' && (pet.mood === 'sleepy' || isNight());

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => setBlink(false), 140);
          loop();
        },
        2200 + Math.random() * 2600,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // 가끔 통통 (알은 데굴데굴 흔들림)
  useEffect(() => {
    if (sleeping) return;
    const once = Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver: true }),
      Animated.delay(1400 + Math.random() * 1600),
    ]);
    const anim = Animated.loop(once);
    anim.start();
    return () => anim.stop();
  }, [hop, sleeping]);

  useEffect(() => {
    if (!pats) return;
    setHearts((h) => h + 1);
    const t = setTimeout(() => setHearts(0), 1400);
    return () => clearTimeout(t);
  }, [pats]);

  const rects = useMemo(
    () => petRects({ species: pet.species, stage: pet.stage, accessory: pet.accessory, eyesClosed: blink || sleeping, happy: pet.mood === 'happy', progress }),
    [pet.species, pet.stage, pet.accessory, pet.mood, blink, sleeping, progress],
  );
  const px = PET_GRID * size;
  const transform =
    pet.stage === 'egg'
      ? [{ rotate: hop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) }]
      : [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 2] }) }];

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `${pet.name} 쓰다듬기` : `${pet.name}`}>
      <Animated.View style={{ width: px, height: px, transform }}>
        <Runs runs={rects} scale={size} />
      </Animated.View>
      {sleeping ? <Text className="absolute -top-1 right-0 text-fg-weak font-bold">z Z</Text> : null}
      {hearts > 0 ? <Text className="absolute -top-2 left-1/2 text-danger text-lg">♥ ♥</Text> : null}
    </Pressable>
  );
});

/* ───────── 채널 마을 ───────── */

const W = 240;
const H = 90;

/** 언덕 윤곽 (웹 VillageScene 과 같은 식): 4칸마다 높이 하나 */
const HILLS = (() => {
  const out: { x: number; y: number }[] = [];
  for (let x = 0; x < W; x += 4) {
    const y = 50 - 7 * Math.sin(x / 34) - 5 * Math.sin(x / 13 + 1) + (x > 150 && x < 225 ? -6 * Math.sin(((x - 150) / 75) * Math.PI) : 0);
    out.push({ x, y: Math.round(y) });
  }
  return out;
})();

const spriteRuns = (name: VillageSpriteName, colors: Record<string, string>): Run[] => villageSprite(name).rects().map((r) => ({ ...r, c: colors[r.c] ?? '#f0f' }));

/**
 * 채널 마을 그림 (240 × 90 칸). 해금된 건물만 서 있고, 다음에 생길 자리에는 공사장.
 * 라이트는 낮, 다크는 밤 (창 · 등불에 불이 켜진다). 축제 주간에는 등불 줄
 */
export const VillageView = memo(function VillageView({ village }: { village: Village }) {
  const [width, setWidth] = useState(0);
  const dark = useScheme() === 'dark';
  const colors = dark ? VILLAGE_COLORS.dark : VILLAGE_COLORS.light;
  const scale = width / W;

  const runs = useMemo(() => {
    const have = new Set(village.items.filter((i) => i.unlocked).map((i) => i.code));
    // 하늘 · 해 · 구름 · 언덕 · 풀밭 · 길 (넓은 곳은 큰 칸 하나로)
    const out: Run[] = [
      { x: 0, y: 0, w: W, h: H, c: colors.sky },
      { x: 0, y: 34, w: W, h: 20, c: colors.sky2 },
      { x: 206, y: 8, w: 10, h: 10, c: colors.sun },
      { x: 204, y: 10, w: 14, h: 6, c: colors.sun },
    ];
    for (const [x, y] of [
      [20, 10],
      [96, 16],
      [150, 6],
    ])
      out.push({ x: x + 2, y, w: 10, h: 2, c: colors.cloud }, { x, y: y + 2, w: 16, h: 3, c: colors.cloud });
    for (const h of HILLS) out.push({ x: h.x, y: h.y, w: 4, h: 62 - h.y, c: colors.hill });
    out.push({ x: 0, y: 62, w: W, h: 28, c: colors.grass }, { x: 0, y: 78, w: W, h: 5, c: colors.path }, { x: 0, y: 83, w: W, c: colors.path2 });
    if (village.festival) {
      for (let i = 0; i < 13; i++) {
        const x = 6 + i * 19;
        const t = (x % 120) / 120;
        out.push({ x, y: Math.round(6 + 12 * 4 * t * (1 - t) * 0.82), w: 3, h: 4, c: ['#ff6b6b', '#ffd23f', '#6bc6ff'][i % 3] });
      }
    }
    // 건물: 뒤쪽(바닥이 위)부터
    const placed: { sprite: VillageSpriteName; x: number; base: number }[] = [];
    for (const [code, lots] of Object.entries(VILLAGE_LOTS)) {
      if (have.has(code)) placed.push(...lots);
      else if (village.next?.code === code) placed.push({ sprite: 'scaffold', x: lots[0].x + Math.max(0, (villageSprite(lots[0].sprite).w - 16) / 2), base: lots[0].base });
    }
    placed.sort((a, b) => a.base - b.base);
    for (const p of placed) {
      const s = villageSprite(p.sprite);
      const top = p.base - s.h;
      out.push(...spriteRuns(p.sprite, colors).map((r) => ({ ...r, x: r.x + p.x, y: r.y + top })));
      if (p.sprite === 'campfire') out.push(...spriteRuns('flame', colors).map((r) => ({ ...r, x: r.x + p.x, y: r.y + top - 6 })));
      if (p.sprite === 'windmill') out.push(...spriteRuns('blades', colors).map((r) => ({ ...r, x: r.x + p.x, y: r.y + top - 2 })));
    }
    return out;
  }, [village, colors]);

  const have = village.items.filter((i) => i.unlocked).map((i) => i.name);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%', aspectRatio: W / H, borderRadius: 10, overflow: 'hidden' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`마을 Lv.${village.level}: ${have.join(', ')}`}
    >
      {width > 0 ? <Runs runs={runs} scale={scale} /> : null}
    </View>
  );
});
