import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  ChallengeInput,
  CodeInput,
  EmailCodeInput,
  LoginInput,
  LoginVerifyInput,
  PasswordConfirmInput,
  PasswordInput,
  ProfileInput,
  SignupInput,
} from './auth.dto';
import { LoginUser, Public } from './auth.guard';
import { AuthService } from './auth.service';
import type { AuthUser } from './jwt.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 회원가입 인증번호 받기 (같은 이메일은 60초에 한 번) */
  @Public()
  @Post('auth/signup/code')
  @HttpCode(HttpStatus.NO_CONTENT)
  signupCode(@Body() input: EmailCodeInput) {
    return this.auth.sendSignupCode(input.email);
  }

  @Public()
  @Post('auth/signup')
  signup(@Body() input: SignupInput) {
    return this.auth.signup(input);
  }

  /** 2단계 인증이 켜져 있으면 token 대신 twoFactorRequired + challenge 가 온다 */
  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() input: LoginInput) {
    return this.auth.login(input);
  }

  @Public()
  @Post('auth/login/verify')
  @HttpCode(HttpStatus.OK)
  verifyLogin(@Body() input: LoginVerifyInput) {
    return this.auth.verifyLogin(input.challenge, input.code);
  }

  /** 로그인 인증번호 다시 받기: 새 challenge 를 돌려준다 */
  @Public()
  @Post('auth/login/resend')
  @HttpCode(HttpStatus.OK)
  resendLoginCode(@Body() input: ChallengeInput) {
    return this.auth.resendLoginCode(input.challenge);
  }

  @Get('me')
  me(@LoginUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Put('me/profile')
  updateProfile(@LoginUser() user: AuthUser, @Body() input: ProfileInput) {
    return this.auth.updateProfile(user.id, input.nickname);
  }

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@LoginUser() user: AuthUser, @Body() input: PasswordInput) {
    return this.auth.changePassword(user.id, input);
  }

  /** 2단계 인증 켜기: 내 이메일로 번호 보내기 → 번호 확인 */
  @Post('me/2fa/code')
  @HttpCode(HttpStatus.NO_CONTENT)
  twoFactorCode(@LoginUser() user: AuthUser) {
    return this.auth.sendTwoFactorCode(user.id);
  }

  @Post('me/2fa/enable')
  @HttpCode(HttpStatus.OK)
  enableTwoFactor(@LoginUser() user: AuthUser, @Body() input: CodeInput) {
    return this.auth.enableTwoFactor(user.id, input.code);
  }

  @Post('me/2fa/disable')
  @HttpCode(HttpStatus.OK)
  disableTwoFactor(@LoginUser() user: AuthUser, @Body() input: PasswordConfirmInput) {
    return this.auth.disableTwoFactor(user.id, input.password);
  }
}
