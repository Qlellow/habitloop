import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

/** 문자열이고 공백만 있지 않아야 한다 (Java 의 @NotBlank) */
export function NotBlank(message: string) {
  return applyDecorators(IsString({ message }), Matches(/\S/, { message }));
}
