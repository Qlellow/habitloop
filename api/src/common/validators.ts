import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, registerDecorator, type ValidationArguments } from 'class-validator';

/** 문자열이고 공백만 있지 않아야 한다 (Java 의 @NotBlank) */
export function NotBlank(message: string) {
  return applyDecorators(IsString({ message }), Matches(/\S/, { message }));
}

/** 비밀번호에 쓸 수 있는 특수문자 (키보드의 ASCII 기호 전부) */
const SPECIAL = /[!-/:-@[-`{-~]/;
const ALLOWED = /^[A-Za-z0-9!-/:-@[-`{-~]*$/;

/**
 * 비밀번호 규칙: 8~64자, 영문 대소문자·숫자·특수문자만, 숫자와 특수문자를 하나 이상.
 * 맞지 않으면 무엇이 문제인지 한 가지를 알려 준다 (웹·앱의 안내와 같은 순서).
 */
export function passwordProblem(v: string): string | undefined {
  if (v.length < 8) return '비밀번호는 8자 이상이어야 해요';
  if (v.length > 64) return '비밀번호는 64자까지 쓸 수 있어요';
  if (!ALLOWED.test(v)) return '비밀번호는 영문, 숫자, 특수문자만 쓸 수 있어요';
  if (!/[0-9]/.test(v)) return '비밀번호에 숫자를 하나 이상 넣어 주세요';
  if (!SPECIAL.test(v)) return '비밀번호에 특수문자를 하나 이상 넣어 주세요';
  return undefined;
}

export function StrongPassword() {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'strongPassword',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (v: unknown) => typeof v === 'string' && !passwordProblem(v),
        defaultMessage: (args?: ValidationArguments) => passwordProblem(String(args?.value ?? '')) ?? '비밀번호를 확인해 주세요',
      },
    });
}
