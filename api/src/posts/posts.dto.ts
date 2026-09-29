import { IsInt, IsOptional, MaxLength } from 'class-validator';
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
}

export class CommentInput {
  @NotBlank('댓글을 입력해 주세요')
  @MaxLength(1000, { message: '댓글은 1000자 이내로 입력해 주세요' })
  content!: string;
}
