import { Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { HttpStatus } from '@nestjs/common';

/** 인증번호를 어디에 쓰는지. 메일 제목과 안내 문구가 달라진다 */
export type CodePurpose = 'SIGNUP' | 'LOGIN' | 'ENABLE_2FA' | 'PASSWORD_RESET' | 'WITHDRAW';

const PURPOSE: Record<CodePurpose, { label: string; guide: string }> = {
  SIGNUP: { label: '회원가입', guide: '루프 회원가입을 마치려면 아래 인증번호를 입력해 주세요.' },
  LOGIN: { label: '로그인', guide: '2단계 인증이 켜진 계정에 로그인하려면 아래 인증번호를 입력해 주세요.' },
  ENABLE_2FA: { label: '2단계 인증 설정', guide: '2단계 인증을 켜려면 아래 인증번호를 입력해 주세요.' },
  PASSWORD_RESET: { label: '비밀번호 재설정', guide: '비밀번호를 다시 설정하려면 아래 인증번호를 입력해 주세요.' },
  WITHDRAW: { label: '회원 탈퇴', guide: '루프 회원 탈퇴를 마치려면 아래 인증번호를 입력해 주세요. 직접 요청하지 않았다면 이 메일을 무시하고 비밀번호를 바꿔 주세요.' },
};

export const CODE_TTL_MINUTES = 5;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 메일 본문. 메일 앱마다 CSS 지원이 달라 인라인 스타일만 쓴다 */
function layout(title: string, body: string) {
  return `<!doctype html><html lang="ko"><body style="margin:0;padding:32px 16px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif">
<div style="max-width:440px;margin:0 auto;padding:32px 28px;border-radius:12px;background:#fff;border:1px solid #e5e8eb">
<div style="margin:0 0 24px;font-size:18px;font-weight:800;color:#3182f6">루프</div>
<h1 style="margin:0 0 12px;font-size:20px;color:#191f28">${title}</h1>
${body}
</div></body></html>`;
}

export function codeMail(purpose: CodePurpose, code: string) {
  const { label, guide } = PURPOSE[purpose];
  return {
    subject: `[루프] ${label} 인증번호 ${code}`,
    text: `${guide}\n\n인증번호: ${code}\n\n${CODE_TTL_MINUTES}분 동안 쓸 수 있어요.\n직접 요청하지 않았다면 이 메일은 무시해 주세요. 누군가 이메일 주소를 잘못 입력했을 수 있어요.\n\n— 루프`,
    html: layout(
      `${escape(label)} 인증번호`,
      `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4e5968">${escape(guide)}</p>
<div style="margin:0 0 20px;padding:20px 0;border-radius:10px;background:#f2f4f6;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#191f28">${code}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#8b95a1">${CODE_TTL_MINUTES}분 동안 쓸 수 있어요.<br>직접 요청하지 않았다면 이 메일은 무시해 주세요.</p>`,
    ),
  };
}

export function noticeMail(subject: string, message: string) {
  return {
    subject: `[루프] ${subject}`,
    text: `${message}\n\n— 루프`,
    html: layout(escape(subject), `<p style="margin:0;font-size:15px;line-height:1.6;color:#4e5968">${escape(message).replace(/\n/g, '<br>')}</p>`),
  };
}

/**
 * 인증번호·알림 메일. MAIL_USERNAME·MAIL_PASSWORD(Gmail 앱 비밀번호)가 있으면 Gmail SMTP 로 보내고,
 * 없으면(로컬 개발·테스트) 서버 로그에 인증번호를 찍는다. 테스트는 lastCode 로 방금 보낸 번호를 읽는다.
 */
@Injectable()
export class Mailer {
  private readonly log = new Logger(Mailer.name);
  private readonly user = process.env.MAIL_USERNAME ?? '';
  private readonly password = process.env.MAIL_PASSWORD ?? '';
  private transport?: import('nodemailer').Transporter;
  private readonly lastCodes = new Map<string, string>();
  private readonly lastNotices = new Map<string, string>();

  get enabled() {
    return !!this.user && !!this.password;
  }

  async sendCode(to: string, purpose: CodePurpose, code: string) {
    this.lastCodes.set(to, code);
    if (!this.enabled) {
      this.log.log(`[메일 미설정] ${to} 에게 보낼 ${PURPOSE[purpose].label} 인증번호: ${code}`);
      return;
    }
    await this.send(to, codeMail(purpose, code));
  }

  async sendNotice(to: string, subject: string, message: string) {
    this.lastNotices.set(to, subject);
    if (!this.enabled) {
      this.log.log(`[메일 미설정] ${to} 에게 보낼 알림: ${subject}`);
      return;
    }
    await this.send(to, noticeMail(subject, message));
  }

  /** 테스트용 */
  lastCode(to: string) {
    return this.lastCodes.get(to);
  }

  lastNotice(to: string) {
    return this.lastNotices.get(to);
  }

  private async send(to: string, mail: { subject: string; text: string; html: string }) {
    try {
      if (!this.transport) {
        const nodemailer = await import('nodemailer');
        this.transport = nodemailer.createTransport({
          host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
          port: Number(process.env.MAIL_PORT ?? 587),
          secure: false,
          requireTLS: true,
          auth: { user: this.user, pass: this.password },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });
      }
      await this.transport.sendMail({ from: { name: '루프', address: process.env.MAIL_FROM || this.user }, to, ...mail });
    } catch (e) {
      this.log.warn(`메일 발송 실패 to=${to}: ${(e as Error).message}`);
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요');
    }
  }
}
