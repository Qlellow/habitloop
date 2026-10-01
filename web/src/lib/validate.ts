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

/** 비밀번호 조건·검사는 앱과 같이 쓰도록 공용 패키지에 있다 (서버와 같은 기준) */
export { passwordRules, passwordProblem as passwordError } from '@loop/shared';

export function confirmError(password: string, confirm: string) {
  if (!confirm) return '비밀번호를 한 번 더 입력해 주세요';
  if (confirm !== password) return '비밀번호가 일치하지 않습니다.';
  return undefined;
}
