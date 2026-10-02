import { IsEmail, Length, Matches, MaxLength } from 'class-validator';
import { NotBlank, StrongPassword } from '../common/validators';

const CODE_FORMAT = /^\s*[A-Za-z1-9]{6}\s*$/;
const CODE_MESSAGE = '인증번호 6자리를 입력해 주세요';

export class EmailCodeInput {
  @NotBlank('이메일을 입력해 주세요')
  @IsEmail({}, { message: '이메일 형식이 아니에요' })
  @MaxLength(100, { message: '이메일이 너무 길어요' })
  email!: string;
}

export class SignupInput {
  @NotBlank('이메일을 입력해 주세요')
  @IsEmail({}, { message: '이메일 형식이 아니에요' })
  @MaxLength(100, { message: '이메일이 너무 길어요' })
  email!: string;

  @NotBlank('비밀번호를 입력해 주세요')
  @StrongPassword()
  password!: string;

  @NotBlank('닉네임을 입력해 주세요')
  @Length(2, 20, { message: '닉네임은 2~20자로 입력해 주세요' })
  nickname!: string;

  @NotBlank('이메일로 받은 인증번호를 입력해 주세요')
  @Matches(CODE_FORMAT, { message: CODE_MESSAGE })
  code!: string;
}

export class LoginInput {
  @NotBlank('이메일을 입력해 주세요')
  email!: string;

  @NotBlank('비밀번호를 입력해 주세요')
  password!: string;
}

/** 2단계 인증 로그인: 비밀번호 확인 뒤 받은 challenge + 이메일로 받은 번호 */
export class LoginVerifyInput {
  @NotBlank('다시 로그인해 주세요')
  challenge!: string;

  @NotBlank('인증번호를 입력해 주세요')
  code!: string;
}

export class ChallengeInput {
  @NotBlank('다시 로그인해 주세요')
  challenge!: string;
}

export class CodeInput {
  @NotBlank('인증번호를 입력해 주세요')
  code!: string;
}

export class PasswordConfirmInput {
  @NotBlank('비밀번호를 입력해 주세요')
  password!: string;
}

export class ProfileInput {
  @NotBlank('닉네임을 입력해 주세요')
  @Length(2, 20, { message: '닉네임은 2~20자로 입력해 주세요' })
  nickname!: string;
}

export class PasswordInput {
  @NotBlank('지금 비밀번호를 입력해 주세요')
  currentPassword!: string;

  @NotBlank('새 비밀번호를 입력해 주세요')
  @StrongPassword()
  newPassword!: string;
}

/** 비밀번호 재설정 3단계: 이메일 인증 뒤 받은 토큰 + 새 비밀번호 */
export class PasswordResetInput {
  @NotBlank('처음부터 다시 시도해 주세요')
  resetToken!: string;

  @NotBlank('새 비밀번호를 입력해 주세요')
  @StrongPassword()
  newPassword!: string;
}

export class AgeInput {
  @NotBlank('생년월일을 입력해 주세요')
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '생년월일을 YYYY-MM-DD 로 입력해 주세요' })
  birthDate!: string;
}
