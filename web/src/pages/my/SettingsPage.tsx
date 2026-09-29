import { updateSettings, useSettings, type Settings } from '../../lib/settings';
import ui from '../../components/ui.module.css';
import s from './my.module.css';

function Segment<K extends keyof Settings>({
  name,
  value,
  options,
}: {
  name: K;
  value: Settings[K];
  options: [Settings[K], string][];
}) {
  return (
    <div className={s.segment} role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => updateSettings({ [name]: v } as Partial<Settings>)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  return (
    <>
      <div className={s.head}>
        <h1 className={s.title}>설정</h1>
        <p className={s.desc}>바로 적용되고, 이 브라우저에 저장돼요.</p>
      </div>
      <section className={`${ui.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>화면</h2>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>테마</div>
            <div className={s.optionDesc}>시스템 설정을 고르면 기기의 라이트/다크 모드를 따라가요.</div>
          </div>
          <Segment
            name="theme"
            value={settings.theme}
            options={[
              ['system', '시스템 설정'],
              ['light', '라이트'],
              ['dark', '다크'],
            ]}
          />
        </div>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>글 목록 미리보기</div>
            <div className={s.optionDesc}>글 목록에서 제목 아래에 본문 두 줄을 보여 줘요.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.showExcerpt}
            aria-label="글 목록 미리보기"
            className={s.switch}
            onClick={() => updateSettings({ showExcerpt: !settings.showExcerpt })}
          />
        </div>
      </section>
      <section className={`${ui.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>글쓰기</h2>
        <div className={s.option}>
          <div>
            <div className={s.optionLabel}>편집기 기본 보기</div>
            <div className={s.optionDesc}>글쓰기 화면을 열 때 처음 보이는 방식이에요. (좁은 화면에서는 나란히 대신 작성)</div>
          </div>
          <Segment
            name="editorMode"
            value={settings.editorMode}
            options={[
              ['write', '작성'],
              ['split', '나란히'],
              ['preview', '미리보기'],
            ]}
          />
        </div>
      </section>
    </>
  );
}
