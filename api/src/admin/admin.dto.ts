import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotBlank } from '../common/validators';

export class AdminLoginCodeInput {
  @NotBlank('이메일을 입력해 주세요')
  @MaxLength(254)
  email!: string;

  @NotBlank('비밀번호를 입력해 주세요')
  @MaxLength(100)
  password!: string;
}

export class AdminLoginInput extends AdminLoginCodeInput {
  @IsString()
  @MaxLength(20)
  code!: string;
}

export class AdminReportActionInput {
  @IsInt()
  postId!: number;

  @IsOptional()
  @IsInt()
  commentId?: number;

  @IsIn(['hide', 'unhide', 'delete', 'dismiss'], { message: '처리 방법을 골라 주세요' })
  action!: 'hide' | 'unhide' | 'delete' | 'dismiss';
}

export class SuspendInput {
  @IsBoolean()
  suspend!: boolean;
}

export class NoticeInputDto {
  @NotBlank('제목을 입력해 주세요')
  @MaxLength(100, { message: '제목은 100자까지 쓸 수 있어요' })
  title!: string;

  @NotBlank('내용을 입력해 주세요')
  @MaxLength(20000, { message: '내용은 20,000자까지 쓸 수 있어요' })
  body!: string;

  @IsIn(['update', 'notice', 'event', 'maintenance'], { message: '종류를 골라 주세요' })
  kind!: 'update' | 'notice' | 'event' | 'maintenance';

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '버전은 20자까지 쓸 수 있어요' })
  version?: string | null;
}
