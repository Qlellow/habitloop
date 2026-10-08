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
