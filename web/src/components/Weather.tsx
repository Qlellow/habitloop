import { memo, type CSSProperties } from 'react';
import { REACTIONS, WEATHER, useCommunityWeather, type CommunityWeather, type WeatherReport } from '@loop/shared';
import { useSettings } from '../lib/settings';
import { cn } from '../lib/cn';

/**
 * 커뮤니티 감정 날씨: 최근 24시간의 공감 · 감정 반응으로 커뮤니티 분위기를 날씨로 (API /api/community/weather).
 *  - WeatherIcon: 움직이는 날씨 그림 (해 · 구름 · 빗방울 · 바람 · 고요)
 *  - WeatherSky: 홈 화면 뒤에 깔리는 날씨 (카드 사이 · 헤더 너머로 비친다). 설정에서 끌 수 있다
 *  - WeatherSummary: 홈 위젯 내용 (날씨 · 체감 온도 · 한 줄 · 감정 막대)
 */

export { WEATHER };

const hasSun = (w: CommunityWeather) => w === 'sunny' || w === 'hot' || w === 'partly';
const cloudsOf = (w: CommunityWeather) => (w === 'partly' ? 1 : w === 'windy' ? 1 : w === 'cloudy' ? 2 : w === 'rain' ? 2 : 0);

/** 움직이는 날씨 그림 (CSS 로만 그린다) */
export const WeatherIcon = memo(function WeatherIcon({ weather, size = 64 }: { weather: CommunityWeather; size?: number }) {
  return (
    <span className={cn('wx-icon', `wx-${weather}`)} style={{ '--s': `${size}px` } as CSSProperties} aria-hidden>
      {hasSun(weather) && (
        <span className="wx-sun">
          <span className="wx-rays" />
        </span>
      )}
      {weather === 'calm' && <span className="wx-moonish" />}
      {Array.from({ length: cloudsOf(weather) }, (_, i) => (
        <span key={i} className={cn('wx-cloud', i === 1 && 'wx-cloud-back')} />
      ))}
      {weather === 'rain' && (
        <span className="wx-drops">
          <i />
          <i />
          <i />
        </span>
      )}
      {weather === 'windy' && (
        <span className="wx-wind">
          <i />
          <i />
        </span>
      )}
      {weather === 'calm' && (
        <span className="wx-motes">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
});

/** 빗줄기 · 먼지 자리 (그릴 때마다 바뀌지 않게 고정된 씨앗으로) */
const DROPS = (() => {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 70 }, () => ({ left: rand() * 100, delay: -rand() * 1.6, duration: 0.8 + rand() * 0.7, len: 40 + rand() * 60, top: rand() * 100 }));
})();

/** 홈 화면 뒤의 날씨 (고정, 누를 수 없음). 날씨 효과를 껐거나 아직 모르면 그리지 않는다 */
export function WeatherSky() {
  const { weatherFx } = useSettings();
  const { data } = useCommunityWeather(weatherFx);
  if (!weatherFx || !data) return null;
  const w = data.weather;
  return (
    <div className={cn('weather-sky', `weather-sky-${w}`)} aria-hidden>
      {hasSun(w) && <div className="wsky-glow" />}
      {(w === 'partly' || w === 'cloudy' || w === 'rain' || w === 'windy') && (
        <div className="wsky-clouds">
          {Array.from({ length: w === 'partly' || w === 'windy' ? 3 : 6 }, (_, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )}
      {w === 'rain' && (
        // 빗방울마다 애니메이션을 두지 않고, 빗방울을 깐 긴 판 두 장(가까운 비 · 먼 비)만 아래로 흘린다 (판 위아래가 같은 무늬라 이어진다)
        <div className="wsky-rain">
          {[DROPS.slice(0, 30), DROPS.slice(30)].map((list, layer) => (
            <div key={layer} className={cn('wsky-rain-sheet', layer === 1 && 'is-far')}>
              {list.flatMap((d, i) =>
                [0, 50].map((off) => <span key={`${i}-${off}`} style={{ left: `${d.left}%`, top: `${off + d.top / 2}%`, height: layer ? d.len * 0.6 : d.len }} />),
              )}
            </div>
          ))}
        </div>
      )}
      {w === 'windy' && (
        <div className="wsky-wind">
          {DROPS.slice(0, 8).map((d, i) => (
            <span key={i} style={{ top: `${d.top}%`, width: d.len * 2, animationDelay: `${d.delay * 3}s`, animationDuration: `${d.duration * 3}s` }} />
          ))}
        </div>
      )}
      {w === 'calm' && (
        <div className="wsky-motes">
          {DROPS.slice(0, 12).map((d, i) => (
            <span key={i} style={{ left: `${d.left}%`, top: `${d.top}%`, animationDelay: `${d.delay * 5}s`, animationDuration: `${d.duration * 9}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 감정 막대에 쓰는 색 (공감 + 반응 다섯) */
const MOODS = [
  { key: 'likes', emoji: '❤️', label: '공감', color: '#f0577b' },
  ...REACTIONS.map((r) => ({
    key: r.kind,
    emoji: r.emoji,
    label: r.label,
    color: { clap: '#f5b84a', laugh: '#f08a3c', wow: '#8b7cf6', sad: '#5b9bf0', fire: '#ef5a3a' }[r.kind],
  })),
] as const;

/** 홈 위젯: 날씨 그림 · 이름 · 체감 온도 · 한 줄 · 감정 막대 */
export function WeatherSummary({ report, bars = true }: { report: WeatherReport; bars?: boolean }) {
  const meta = WEATHER[report.weather];
  const s = report.stats;
  const total = MOODS.reduce((n, m) => n + s[m.key], 0);
  return (
    <div className="px-5 pb-4">
      <div className="flex items-center gap-4">
        <WeatherIcon weather={report.weather} size={64} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <b className="text-[22px] text-fg-strong">{meta.label}</b>
            <span className="text-[15px] font-semibold text-fg-sub tabular-nums">{report.temperature}°</span>
          </div>
          <p className="m-0 text-[13px] leading-snug text-fg-sub">{meta.message}</p>
        </div>
      </div>
      {bars && total > 0 && (
        <>
          <div className="wx-bar mt-4" role="img" aria-label={MOODS.map((m) => `${m.label} ${s[m.key]}`).join(', ')}>
            {MOODS.filter((m) => s[m.key] > 0).map((m) => (
              <span key={m.key} style={{ flexGrow: s[m.key], background: m.color }} title={`${m.label} ${s[m.key]}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2 text-[12px] text-fg-weak">
            {MOODS.filter((m) => s[m.key] > 0).map((m) => (
              <span key={m.key} className="tabular-nums">
                {m.emoji} {Math.round((s[m.key] / total) * 100)}%
              </span>
            ))}
          </div>
        </>
      )}
      <div className="mt-2 text-[12px] text-fg-weak">
        최근 24시간 · 글 {s.posts} · 댓글 {s.comments}
      </div>
    </div>
  );
}
