/** 로그인 · 회원가입 입력 검사. 오류가 없으면 undefined, 있으면 사용자에게 보여 줄 문장 */

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(v: string) {
  const email = v.trim();
  if (!email) return '이메일을 입력해 주세요';
  if (!EMAIL.test(email)) return '이메일 형식이 맞지 않아요. 예) loop@example.com';
  if (email.length > 100) return '이메일이 너무 길어요';
  return undefined;
}

export function nicknameError(v: string) {
  const nickname = v.trim();
  if (!nickname) return '닉네임을 입력해 주세요';
  if (nickname.length < 2 || nickname.length > 20) return '닉네임은 2~20자로 정해 주세요';
  return undefined;
}

/** 비밀번호 조건 (서버와 같은 기준: 8~64자) */
export const passwordRules = (v: string) => [{ label: '8자 이상 64자 이하', ok: v.length >= 8 && v.length <= 64 }];

export function passwordError(v: string) {
  if (!v) return '비밀번호를 입력해 주세요';
  if (v.length < 8) return `비밀번호는 8자 이상이어야 해요 (지금 ${v.length}자)`;
  if (v.length > 64) return '비밀번호는 64자까지 쓸 수 있어요';
  return undefined;
}

export function confirmError(password: string, confirm: string) {
  if (!confirm) return '비밀번호를 한 번 더 입력해 주세요';
  if (confirm !== password) return '비밀번호가 일치하지 않습니다.';
  return undefined;
}
