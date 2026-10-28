import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** 서버가 받는 이미지 크기 (api/src/images/images.service.ts MAX_IMAGE_BYTES 와 같게) */
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * 사진첩에서 이미지를 하나 골라 올릴 수 있는 크기로 줄인 Blob(과 미리보기용 파일 주소)으로 돌려준다. 고르지 않으면 null.
 * square: 채널 아이콘 · 프로필 사진처럼 정사각형으로 자르기 (기기의 자르기 화면)
 * 휴대폰 사진은 3MB 를 넘기 쉬워서 긴 변을 줄이고 JPEG 로 다시 저장한다 (GIF 는 움직임이 깨지므로 그대로)
 */
export async function pickImage({ square = false, maxSide = 1600 }: { square?: boolean; maxSide?: number } = {}): Promise<{ blob: Blob; uri: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  let uri = asset.uri;
  if (asset.mimeType !== 'image/gif') {
    const ctx = ImageManipulator.manipulate(asset.uri);
    const long = Math.max(asset.width, asset.height);
    if (long > maxSide) ctx.resize(asset.width >= asset.height ? { width: maxSide } : { height: maxSide });
    const ref = await ctx.renderAsync();
    uri = (await ref.saveAsync({ compress: 0.82, format: SaveFormat.JPEG })).uri;
  }
  const blob = await (await fetch(uri)).blob();
  if (blob.size > MAX_BYTES) throw new Error('이미지는 3MB 이하로 올려 주세요');
  // 안드로이드는 type 이 비어 있을 때가 있어서 서버가 알 수 있게 채운다
  return { blob: blob.type ? blob : new Blob([blob], { type: asset.mimeType === 'image/gif' ? 'image/gif' : 'image/jpeg' }), uri };
}
