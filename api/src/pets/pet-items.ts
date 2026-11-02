/**
 * 펫 꾸미기 아이템 (포인트로 산다). 모자는 하나, 색은 하나를 골라 입힌다.
 * 리본 · 왕관은 레벨(15 · 20)이 되면 공짜로 열리고, 그 전에는 포인트로도 살 수 있다.
 * 그림은 packages/shared/src/pixel/pet.ts (같은 id)
 */
export type PetItemKind = 'hat' | 'color';

export interface PetItemDef {
  id: string;
  kind: PetItemKind;
  name: string;
  price: number;
  /** 이 레벨이 되면 공짜로 열린다 */
  freeAt?: number;
}

export const PET_ITEMS: PetItemDef[] = [
  { id: 'ribbon', kind: 'hat', name: '리본', price: 200, freeAt: 15 },
  { id: 'crown', kind: 'hat', name: '왕관', price: 800, freeAt: 20 },
  { id: 'party', kind: 'hat', name: '고깔모자', price: 150 },
  { id: 'flower', kind: 'hat', name: '꽃핀', price: 120 },
  { id: 'beanie', kind: 'hat', name: '털모자', price: 180 },
  { id: 'glasses', kind: 'hat', name: '동글 안경', price: 150 },
  { id: 'mint', kind: 'color', name: '민트색', price: 300 },
  { id: 'pink', kind: 'color', name: '분홍색', price: 300 },
  { id: 'purple', kind: 'color', name: '보라색', price: 300 },
  { id: 'gold', kind: 'color', name: '황금색', price: 500 },
];

export const PET_ITEM_BY_ID = new Map(PET_ITEMS.map((i) => [i.id, i]));
