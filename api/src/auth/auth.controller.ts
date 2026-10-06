import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import {
  AgeInput,
  AvatarInput,
  BannerInput,
  ChallengeInput,
  CodeInput,
  EmailCodeInput,
  LoginInput,
  LoginVerifyInput,
  PasswordConfirmInput,
  PasswordInput,
  PasswordResetInput,
  ProfileInput,
  SignupInput,
} from './auth.dto';
import { CurrentUser, LoginUser, Public } from './auth.guard';
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

  /** 회원가입 화면에서 닉네임을 입력하는 동안 이미 쓰는 닉네임인지 확인 */
  @Public()
  @Get('auth/nickname')
  nicknameAvailable(@Query('nickname') nickname = '') {
    return this.auth.nicknameAvailable(nickname);
  }

  @Public()
  @Post('auth/signup')
  signup(@Body() input: SignupInput, @Headers('user-agent') ua = '') {
    return this.auth.signup(input, ua);
  }

  /** 2단계 인증이 켜져 있으면 token 대신 twoFactorRequired + challenge 가 온다 */
  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() input: LoginInput, @Headers('user-agent') ua = '') {
    return this.auth.login(input, ua);
  }

  @Public()
  @Post('auth/login/verify')
  @HttpCode(HttpStatus.OK)
  verifyLogin(@Body() input: LoginVerifyInput, @Headers('user-agent') ua = '') {
    return this.auth.verifyLogin(input.challenge, input.code, ua);
  }

  /** 로그아웃: 이 기기의 토큰을 서버에서 폐기한다 (이미 만료된 토큰이어도 204) */
  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: AuthUser | undefined) {
    return this.auth.logout(user);
  }

  /** 로그인 인증번호 다시 받기: 새 challenge 를 돌려준다 */
  @Public()
  @Post('auth/login/resend')
  @HttpCode(HttpStatus.OK)
  resendLoginCode(@Body() input: ChallengeInput) {
    return this.auth.resendLoginCode(input.challenge);
  }

  /** 비밀번호 재설정: 이메일로 번호 받기 → 번호 확인(resetToken) → 새 비밀번호 */
  @Public()
  @Post('auth/password/code')
  @HttpCode(HttpStatus.OK)
  passwordResetCode(@Body() input: EmailCodeInput) {
    return this.auth.sendPasswordResetCode(input.email);
  }

  @Public()
  @Post('auth/password/resend')
  @HttpCode(HttpStatus.OK)
  resendPasswordResetCode(@Body() input: ChallengeInput) {
    return this.auth.resendPasswordResetCode(input.challenge);
  }

  @Public()
  @Post('auth/password/verify')
  @HttpCode(HttpStatus.OK)
  verifyPasswordResetCode(@Body() input: LoginVerifyInput) {
    return this.auth.verifyPasswordResetCode(input.challenge, input.code);
  }

  @Public()
  @Post('auth/password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() input: PasswordResetInput) {
    return this.auth.resetPassword(input);
  }

  @Get('me')
  me(@LoginUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Put('me/profile')
  updateProfile(@LoginUser() user: AuthUser, @Body() input: ProfileInput) {
    return this.auth.updateProfile(user, input.nickname);
  }

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@LoginUser() user: AuthUser, @Body() input: PasswordInput) {
    return this.auth.changePassword(user, input);
  }

  /** 로그인한 기기 목록 · 다른 기기 로그아웃 */
  @Get('me/sessions')
  sessions(@LoginUser() user: AuthUser) {
    return this.auth.sessions(user);
  }

  @Delete('me/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeOtherSessions(@LoginUser() user: AuthUser) {
    return this.auth.revokeOtherSessions(user);
  }

  @Delete('me/sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(@LoginUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeSession(user, id);
  }

  /** 프로필 사진 (올린 이미지 id, null 이면 기본) */
  @Put('me/avatar')
  setAvatar(@LoginUser() user: AuthUser, @Body() input: AvatarInput) {
    return this.auth.setAvatar(user.id, input.imageId ?? null);
  }

  /** 배너: 'p:기본배너' · 'i:이미지id' · null */
  @Put('me/banner')
  setBanner(@LoginUser() user: AuthUser, @Body() input: BannerInput) {
    return this.auth.setBanner(user.id, input.banner ?? null);
  }

  /** 커스텀 배너 열기 (포인트 사용) */
  @Post('me/banner/unlock')
  @HttpCode(HttpStatus.OK)
  unlockBanner(@LoginUser() user: AuthUser) {
    return this.auth.unlockCustomBanner(user.id);
  }

  /** 포인트 내역 */
  @Get('me/points')
  points(@LoginUser() user: AuthUser) {
    return this.auth.pointLogs(user.id);
  }

  /** 나이 확인 (생년월일 저장) */
  @Put('me/age')
  verifyAge(@LoginUser() user: AuthUser, @Body() input: AgeInput) {
    return this.auth.verifyAge(user.id, input.birthDate);
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
