import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { marked, type Token, type Tokens } from 'marked';
import { apiUrl, displayRatio, parseImageSrc } from '@loop/shared';
import { cn } from './cn';

/**
 * 마크다운 → 네이티브 컴포넌트.
 * HTML 을 거치지 않고 marked 의 토큰을 Text/View 로 직접 그리므로 스크립트 삽입(XSS) 걱정이 없다.
 */

const SAFE_URL = /^(https?:|mailto:)/i;

function open(url: string) {
  if (SAFE_URL.test(url)) void Linking.openURL(url);
}

function decode(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 본문 이미지. 웹에서 편집한 설정(주소 뒤 #: 크기 · 비율 · 자르기 · 모양 · 정렬 · 캡션)을 같은 방식으로 그린다.
 * 루프에 올린 이미지(/api/images/…)는 서버 주소를 붙여서 받는다.
 */
function RemoteImage({ src, alt }: { src: string; alt: string }) {
  const { url, params } = parseImageSrc(src);
  const uri = url.startsWith('/api/') ? apiUrl(url) : url;
  const [natural, setNatural] = useState<number>();
  useEffect(() => {
    if (!SAFE_URL.test(uri)) return;
    Image.getSize(
      uri,
      (w, h) => w > 0 && setNatural(h / w),
      () => undefined,
    );
  }, [uri]);
  if (!SAFE_URL.test(uri)) return null;
  const ratio = displayRatio({ ...params, nr: params.nr ?? natural }) ?? natural ?? 9 / 16;
  const c = params.crop;
  const caption = alt.trim();
  return (
    <View className="mb-3.5" style={{ width: `${params.w}%`, alignSelf: params.align === 'left' ? 'flex-start' : params.align === 'right' ? 'flex-end' : 'center' }}>
      <View style={{ width: '100%', aspectRatio: 1 / ratio, overflow: 'hidden', borderRadius: params.shape === 'circle' ? 9999 : params.r }}>
        <Image
          source={{ uri }}
          accessibilityLabel={caption}
          resizeMode="stretch"
          style={
            c
              ? { position: 'absolute', width: `${100 / c.w}%`, height: `${100 / c.h}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%` }
              : { width: '100%', height: '100%' }
          }
        />
      </View>
      {caption ? <Text className="mt-1.5 text-[13px] text-left text-fg-weak">{caption}</Text> : null}
    </View>
  );
}

export const Markdown = memo(function Markdown({ source }: { source: string }) {
  // 같은 본문이면 다시 파싱하지 않는다
  const tokens = useMemo(() => marked.lexer(source, { gfm: true, breaks: true }), [source]);

  const inline = (list: Token[] | undefined, key = ''): ReactNode[] =>
    (list ?? []).map((t, i) => {
      const k = `${key}${i}`;
      switch (t.type) {
        case 'strong':
          return (
            <Text key={k} className={s.strong}>
              {inline(t.tokens, k)}
            </Text>
          );
        case 'em':
          return (
            <Text key={k} className={s.em}>
              {inline(t.tokens, k)}
            </Text>
          );
        case 'del':
          return (
            <Text key={k} className={s.del}>
              {inline(t.tokens, k)}
            </Text>
          );
        case 'codespan':
          return (
            <Text key={k} className={s.codespan}>
              {decode(t.text)}
            </Text>
          );
        case 'br':
          return '\n';
        case 'link':
          return (
            <Text key={k} className={s.link} onPress={() => open(t.href)} accessibilityRole="link">
              {inline(t.tokens, k)}
            </Text>
          );
        case 'image':
          return (
            <Text key={k} className={s.link} onPress={() => open(t.href)}>
              [이미지{t.text ? `: ${t.text}` : ''}]
            </Text>
          );
        case 'text':
          return 'tokens' in t && t.tokens ? inline(t.tokens, k) : decode(t.text);
        default:
          return 'text' in t ? decode(String(t.text)) : null;
      }
    });

  const block = (t: Token, key: string): ReactNode => {
    switch (t.type) {
      case 'heading': {
        const h = t as Tokens.Heading;
        return (
          <Text key={key} className={cn(s.heading, h.depth <= 1 ? s.h1 : h.depth === 2 ? s.h2 : s.h3)}>
            {inline(h.tokens, key)}
          </Text>
        );
      }
      case 'paragraph': {
        const p = t as Tokens.Paragraph;
        // 이미지만 있는 문단은 이미지 블록으로 그린다
        const images = p.tokens.filter((x) => x.type === 'image') as Tokens.Image[];
        const rest = p.tokens.filter((x) => x.type !== 'image' && !(x.type === 'text' && !x.raw.trim()));
        if (images.length && !rest.length) {
          return images.map((img, i) => <RemoteImage key={`${key}-${i}`} src={img.href} alt={img.text} />);
        }
        return (
          <Text key={key} className={s.p}>
            {inline(p.tokens, key)}
          </Text>
        );
      }
      case 'text': {
        const tt = t as Tokens.Text;
        return (
          <Text key={key} className={s.p}>
            {tt.tokens ? inline(tt.tokens, key) : decode(tt.text)}
          </Text>
        );
      }
      case 'list': {
        const l = t as Tokens.List;
        const start = typeof l.start === 'number' ? l.start : 1;
        return (
          <View key={key} className={s.list}>
            {l.items.map((item, i) => (
              <View key={i} className={s.li}>
                <Text className={s.bullet}>{item.task ? (item.checked ? '☑' : '☐') : l.ordered ? `${start + i}.` : '•'}</Text>
                <View className="flex-1">{item.tokens.map((b, j) => block(b, `${key}-${i}-${j}`))}</View>
              </View>
            ))}
          </View>
        );
      }
      case 'blockquote':
        return (
          <View key={key} className={s.quote}>
            {(t as Tokens.Blockquote).tokens.map((b, j) => block(b, `${key}-${j}`))}
          </View>
        );
      case 'code':
        return (
          <ScrollView key={key} horizontal className={s.code} contentContainerClassName="p-3.5">
            <Text className={s.codeText} selectable>
              {(t as Tokens.Code).text}
            </Text>
          </ScrollView>
        );
      case 'hr':
        return <View key={key} className={s.hr} />;
      case 'table': {
        const tb = t as Tokens.Table;
        return (
          <ScrollView key={key} horizontal className="mb-3.5">
            <View className={s.table}>
              {[tb.header, ...tb.rows].map((row, r) => (
                <View key={r} className={cn(s.tr, r === 0 && 'bg-field')}>
                  {row.map((cell, ci) => (
                    <Text key={ci} className={cn(s.td, r === 0 && s.strong)}>
                      {inline(cell.tokens, `${key}-${r}-${ci}`)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      }
      case 'space':
        return null;
      default:
        return 'text' in t ? (
          <Text key={key} className={s.p}>
            {decode(String(t.text))}
          </Text>
        ) : null;
    }
  };

  return <View>{tokens.map((t, i) => block(t, String(i)))}</View>;
});

const s = {
  p: 'text-base leading-[27px] text-fg mb-3.5',
  heading: 'text-fg-strong font-bold mt-2.5 mb-2.5',
  h1: 'text-[22px] leading-[30px]',
  h2: 'text-xl leading-7',
  h3: 'text-lg leading-[26px]',
  strong: 'font-bold text-fg-strong',
  em: 'italic',
  del: 'line-through',
  codespan: 'font-mono text-sm bg-field text-fg-strong',
  link: 'text-primary underline',
  list: 'mb-1.5',
  li: 'flex-row gap-2',
  bullet: 'w-5 text-base leading-[27px] text-fg-sub text-right',
  quote: 'border-l-[3px] border-border pl-3 mb-3.5 opacity-85',
  code: 'bg-field rounded-[12px] mb-3.5',
  codeText: 'font-mono text-[13px] leading-5 text-fg-strong',
  hr: 'h-px bg-border my-[18px]',
  table: 'border border-border rounded-[8px]',
  tr: 'flex-row',
  td: 'min-w-[90px] px-2.5 py-2 border-[0.5px] border-border text-fg text-sm',
};
