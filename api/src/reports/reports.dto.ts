import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** 신고 사유 */
export const REPORT_REASONS = ['spam', 'abuse', 'adult', 'illegal', 'privacy', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export class ReportInput {
  @IsIn(REPORT_REASONS, { message: '신고 사유를 골라 주세요' })
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: '자세한 내용은 300자 이내로 적어 주세요' })
  detail?: string;
}

/** 신고함 처리: 숨기기 · 숨김 풀기 · 지우기 · 문제 없음 */
export const REPORT_ACTIONS = ['hide', 'unhide', 'delete', 'dismiss'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export class ReportActionInput {
  @IsInt()
  postId!: number;

  @IsOptional()
  @IsInt()
  commentId?: number;

  @IsIn(REPORT_ACTIONS, { message: '처리 방법을 골라 주세요' })
  action!: ReportAction;
}
