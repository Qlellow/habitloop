/** 프로필 이미지 한 변 길이. 화면에서 가장 크게 보이는 곳(56px)의 레티나 4배를 넉넉히 덮는다 */
const ICON_SIZE = 256;

/**
 * 고른 사진을 정사각형으로 자르고(자르기 창에서 고른 영역, 없으면 가운데) 256px 로 줄인다.
 * 서버에는 수십 KB 짜리 작은 이미지만 올라가고, 사진 속 위치 정보(EXIF) 같은 메타데이터도 떨어진다.
 * WebP 를 못 만드는 브라우저(구형 Safari)는 PNG 로 만든다.
 */
export async function toSquareIcon(file: File, crop?: { x: number; y: number; w: number; h: number }): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일을 골라 주세요');
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 사진을 골라 주세요');

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('사진을 읽지 못했어요. 다른 사진을 골라 주세요');
  });
  // 자르기 창에서 고른 영역(1:1)이 있으면 그 영역, 없으면 가운데 정사각형
  const side = crop ? Math.min(crop.w * bitmap.width, crop.h * bitmap.height) : Math.min(bitmap.width, bitmap.height);
  const sx = crop ? crop.x * bitmap.width : (bitmap.width - side) / 2;
  const sy = crop ? crop.y * bitmap.height : (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    sx,
    sy,
    side,
    side,
    0,
    0,
    ICON_SIZE,
    ICON_SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (blob && blob.type === 'image/webp') return blob;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 바꾸지 못했어요'))), 'image/png'),
  );
}
