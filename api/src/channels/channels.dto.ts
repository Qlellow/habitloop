import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { NotBlank } from '../common/validators';
import { ROLES, type ChannelRole } from './roles';

/** 채널 소개(마크다운) 최대 길이 */
export const MAX_DESCRIPTION = 2000;

export class ChannelInput {
  @NotBlank('채널 고리를 입력해 주세요')
  @Matches(/^[a-z0-9][a-z0-9_-]{1,29}$/, { message: '고리는 영문 소문자·숫자·-·_ 로 2~30자여야 해요' })
  slug!: string;

  @NotBlank('채널 이름을 입력해 주세요')
  @Length(2, 20, { message: '채널 이름은 2~20자로 입력해 주세요' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION, { message: '소개는 2000자 이내로 입력해 주세요' })
  description?: string;
}

export class ChannelUpdateInput {
  @NotBlank('채널 이름을 입력해 주세요')
  @Length(2, 20, { message: '채널 이름은 2~20자로 입력해 주세요' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION, { message: '소개는 2000자 이내로 입력해 주세요' })
  description?: string;
}

export class CategoryInput {
  @NotBlank('카테고리 이름을 입력해 주세요')
  @MaxLength(20, { message: '카테고리 이름은 20자 이내로 입력해 주세요' })
  name!: string;

  @IsOptional()
  @IsBoolean()
  ownerOnly?: boolean;
}

export class CategoryOrderInput {
  @IsArray({ message: '순서를 보내 주세요' })
  @IsInt({ each: true, message: '순서를 보내 주세요' })
  @Type(() => Number)
  ids!: number[];
}

export class RoleInput {
  @IsIn(ROLES, { message: '역할을 골라 주세요' })
  role!: ChannelRole;
}
