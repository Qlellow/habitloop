import { makeStyles } from './theme';

/** 로그인·회원가입 화면 공통 스타일 */
export const useAuthStyles = makeStyles((c) => ({
  flex: { flex: 1, backgroundColor: c.surface },
  wrap: { padding: 24 },
  title: { fontSize: 26, fontWeight: '700', lineHeight: 36, color: c.textStrong, marginBottom: 28 },
  label: { marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: '600', color: c.sub },
  error: { marginTop: 12, fontSize: 14, color: c.danger },
  switch: { marginTop: 20, textAlign: 'center', fontSize: 15, color: c.sub },
  link: { color: c.primary, fontWeight: '600' },
  hint: { marginTop: 24, padding: 12, borderRadius: 10, backgroundColor: c.field, fontSize: 13, color: c.sub, overflow: 'hidden' },
}));
