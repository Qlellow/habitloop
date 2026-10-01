import { displayRatio, type ImageParams } from '@loop/shared';

// 편집 설정 형식(주소 뒤 #)과 마크다운 이미지 찾기·바꾸기는 앱과 같이 쓰도록 공용 패키지에 있다
export {
  DEFAULT_PARAMS,
  buildImageSrc,
  displayRatio,
  findImageToken,
  parseImageSrc,
  removeImageToken,
  replaceImageToken,
  type CropRect,
  type ImageAlign,
  type ImageParams,
  type ImageShape,
} from '@loop/shared';

/** 화면(DOM)에서만 쓰는 부분: 렌더링된 이미지에 스타일 입히기, 올리기 전에 줄이기 */

/** 렌더링된 이미지 묶음(.loop-img)에 편집 설정대로 스타일을 입힌다 (본문 · 편집 미리보기 공용) */
export function applyImageStyles(root: HTMLElement, p: ImageParams) {
  const frame = root.querySelector<HTMLElement>('.loop-img-frame');
  const img = root.querySelector<HTMLImageElement>('img');
  if (!frame || !img) return;
  root.style.width = `${p.w}%`;
  root.style.marginLeft = p.align === 'left' ? '0' : 'auto';
  root.style.marginRight = p.align === 'right' ? '0' : 'auto';
  frame.style.borderRadius = p.shape === 'circle' ? '50%' : `${p.r}px`;
  const ratio = displayRatio(p);
  frame.style.aspectRatio = ratio ? `${1 / ratio}` : '';
  if (p.crop) {
    const { x, y, w, h } = p.crop;
    Object.assign(img.style, {
      position: 'absolute',
      maxWidth: 'none',
      width: `${100 / w}%`,
      height: `${100 / h}%`,
      left: `${(-x / w) * 100}%`,
      top: `${(-y / h) * 100}%`,
    });
  } else if (ratio) {
    // 자르지 않고 비율만 바꾼 경우: 틀에 맞춰 늘이거나 줄인다 (그림판처럼 자유 변형)
    Object.assign(img.style, { position: 'absolute', maxWidth: 'none', width: '100%', height: '100%', left: '0', top: '0' });
  } else {
    Object.assign(img.style, { position: '', maxWidth: '', width: '', height: '', left: '', top: '' });
  }
}

/** 업로드할 수 있게 사진을 줄인다: 긴 변 1920px, WebP (GIF 는 움직임을 지키려고 그대로) */
export async function prepareUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일을 골라 주세요');
  if (file.type === 'image/gif') {
    if (file.size > 3 * 1024 * 1024) throw new Error('GIF 는 3MB 이하로 올려 주세요');
    return file;
  }
  if (file.size > 30 * 1024 * 1024) throw new Error('30MB 이하의 사진을 골라 주세요');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('사진을 읽지 못했어요. 다른 사진을 골라 주세요');
  });
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (blob && blob.type === 'image/webp') return blob;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 바꾸지 못했어요'))), 'image/jpeg', 0.88),
  );
}

