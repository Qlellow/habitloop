import { IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotBlank } from '../common/validators';

export class CreatePostInput {
  @NotBlank('채널을 골라 주세요')
  channel!: string;

  @IsOptional()
  @IsInt({ message: '카테고리를 다시 골라 주세요' })
  categoryId?: number | null;

  @NotBlank('제목을 입력해 주세요')
  @MaxLength(100, { message: '제목은 100자 이내로 입력해 주세요' })
  title!: string;

  @NotBlank('내용을 입력해 주세요')
  @MaxLength(20000, { message: '내용이 너무 길어요' })
  content!: string;

  /** 연재: 내 시리즈에 넣기 (null 이면 빼기) */
  @IsOptional()
  @IsInt({ message: '시리즈를 다시 골라 주세요' })
  seriesId?: number | null;

  /** 연재: 새 시리즈를 만들어 넣기 */
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: '시리즈 이름은 60자 이내로 입력해 주세요' })
  newSeries?: string;

  /** 투표: 선택지 2~6개 (글을 올릴 때만, 나중에 바꿀 수 없다). 형식은 PostExtrasService.parsePoll 에서 검사 */
  @IsOptional()
  @IsObject({ message: '투표를 다시 만들어 주세요' })
  poll?: { options?: unknown; multiple?: unknown; closesInHours?: unknown };
}

/** 글을 옮기면 채널 글 수가 꼬이므로 채널은 바꿀 수 없다. 채널 안의 카테고리는 바꿀 수 있다. */
export class UpdatePostInput {
  @IsOptional()
  @IsInt({ message: '카테고리를 다시 골라 주세요' })
  categoryId?: number | null;

  @NotBlank('제목을 입력해 주세요')
  @MaxLength(100, { message: '제목은 100자 이내로 입력해 주세요' })
  title!: string;

  @NotBlank('내용을 입력해 주세요')
  @MaxLength(20000, { message: '내용이 너무 길어요' })
  content!: string;

  /** 연재: 내 시리즈에 넣기 (null 이면 빼기) */
  @IsOptional()
  @IsInt({ message: '시리즈를 다시 골라 주세요' })
  seriesId?: number | null;

  /** 연재: 새 시리즈를 만들어 넣기 */
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: '시리즈 이름은 60자 이내로 입력해 주세요' })
  newSeries?: string;
}

export class CommentInput {
  @NotBlank('댓글을 입력해 주세요')
  @MaxLength(1000, { message: '댓글은 1000자 이내로 입력해 주세요' })
  content!: string;

  /** 답글이면 어느 댓글에 다는지 */
  @IsOptional()
  @IsInt()
  parentId?: number;
}

export class CommentUpdateInput {
  @NotBlank('댓글을 입력해 주세요')
  @MaxLength(1000, { message: '댓글은 1000자 이내로 입력해 주세요' })
  content!: string;
}
