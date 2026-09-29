import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Linking, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { marked, type Token, type Tokens } from 'marked';
import { makeStyles, mono, useColors } from './theme';

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

function RemoteImage({ uri, alt }: { uri: string; alt: string }) {
  const { width } = useWindowDimensions();
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    Image.getSize(uri, (w, h) => h > 0 && setRatio(w / h), () => undefined);
  }, [uri]);
  if (!SAFE_URL.test(uri)) return null;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt}
      style={{ width: '100%', maxWidth: width, aspectRatio: ratio, borderRadius: 12, marginBottom: 14 }}
      resizeMode="cover"
    />
  );
}

export const Markdown = memo(function Markdown({ source }: { source: string }) {
  const s = useStyles();
  const c = useColors();
  // 같은 본문이면 다시 파싱하지 않는다
  const tokens = useMemo(() => marked.lexer(source, { gfm: true, breaks: true }), [source]);

  const inline = (list: Token[] | undefined, key = ''): ReactNode[] =>
    (list ?? []).map((t, i) => {
      const k = `${key}${i}`;
      switch (t.type) {
        case 'strong':
          return (
            <Text key={k} style={s.strong}>
              {inline(t.tokens, k)}
            </Text>
          );
        case 'em':
          return (
            <Text key={k} style={s.em}>
              {inline(t.tokens, k)}
            </Text>
          );
        case 'del':
          return (
            <Text key={k} style={s.del}>
              {inline(t.tokens, k)}
            </Text>
          );
        case 'codespan':
          return (
            <Text key={k} style={s.codespan}>
              {decode(t.text)}
            </Text>
          );
        case 'br':
          return '\n';
        case 'link':
          return (
            <Text key={k} style={s.link} onPress={() => open(t.href)} accessibilityRole="link">
              {inline(t.tokens, k)}
            </Text>
          );
        case 'image':
          return (
            <Text key={k} style={s.link} onPress={() => open(t.href)}>
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
          <Text key={key} style={[s.heading, h.depth <= 1 ? s.h1 : h.depth === 2 ? s.h2 : s.h3]}>
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
          return images.map((img, i) => <RemoteImage key={`${key}-${i}`} uri={img.href} alt={img.text} />);
        }
        return (
          <Text key={key} style={s.p}>
            {inline(p.tokens, key)}
          </Text>
        );
      }
      case 'text': {
        const tt = t as Tokens.Text;
        return (
          <Text key={key} style={s.p}>
            {tt.tokens ? inline(tt.tokens, key) : decode(tt.text)}
          </Text>
        );
      }
      case 'list': {
        const l = t as Tokens.List;
        const start = typeof l.start === 'number' ? l.start : 1;
        return (
          <View key={key} style={s.list}>
            {l.items.map((item, i) => (
              <View key={i} style={s.li}>
                <Text style={s.bullet}>{item.task ? (item.checked ? '☑' : '☐') : l.ordered ? `${start + i}.` : '•'}</Text>
                <View style={{ flex: 1 }}>{item.tokens.map((b, j) => block(b, `${key}-${i}-${j}`))}</View>
              </View>
            ))}
          </View>
        );
      }
      case 'blockquote':
        return (
          <View key={key} style={s.quote}>
            {(t as Tokens.Blockquote).tokens.map((b, j) => block(b, `${key}-${j}`))}
          </View>
        );
      case 'code':
        return (
          <ScrollView key={key} horizontal style={s.code} contentContainerStyle={{ padding: 14 }}>
            <Text style={s.codeText} selectable>
              {(t as Tokens.Code).text}
            </Text>
          </ScrollView>
        );
      case 'hr':
        return <View key={key} style={s.hr} />;
      case 'table': {
        const tb = t as Tokens.Table;
        return (
          <ScrollView key={key} horizontal style={{ marginBottom: 14 }}>
            <View style={s.table}>
              {[tb.header, ...tb.rows].map((row, r) => (
                <View key={r} style={[s.tr, r === 0 && { backgroundColor: c.field }]}>
                  {row.map((cell, ci) => (
                    <Text key={ci} style={[s.td, r === 0 && s.strong]}>
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
          <Text key={key} style={s.p}>
            {decode(String(t.text))}
          </Text>
        ) : null;
    }
  };

  return <View>{tokens.map((t, i) => block(t, String(i)))}</View>;
});

const useStyles = makeStyles((c) => ({
  p: { fontSize: 16, lineHeight: 27, color: c.text, marginBottom: 14 },
  heading: { color: c.textStrong, fontWeight: '700', marginTop: 10, marginBottom: 10 },
  h1: { fontSize: 22, lineHeight: 30 },
  h2: { fontSize: 20, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 26 },
  strong: { fontWeight: '700', color: c.textStrong },
  em: { fontStyle: 'italic' },
  del: { textDecorationLine: 'line-through' },
  codespan: { fontFamily: mono, fontSize: 14, backgroundColor: c.field, color: c.textStrong },
  link: { color: c.primary, textDecorationLine: 'underline' },
  list: { marginBottom: 6 },
  li: { flexDirection: 'row', gap: 8 },
  bullet: { width: 20, fontSize: 16, lineHeight: 27, color: c.sub, textAlign: 'right' },
  quote: { borderLeftWidth: 3, borderLeftColor: c.border, paddingLeft: 12, marginBottom: 14, opacity: 0.85 },
  code: { backgroundColor: c.field, borderRadius: 12, marginBottom: 14 },
  codeText: { fontFamily: mono, fontSize: 13, lineHeight: 20, color: c.textStrong },
  hr: { height: 1, backgroundColor: c.border, marginVertical: 18 },
  table: { borderWidth: 1, borderColor: c.border, borderRadius: 8 },
  tr: { flexDirection: 'row' },
  td: { minWidth: 90, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 0.5, borderColor: c.border, color: c.text, fontSize: 14 },
}));
