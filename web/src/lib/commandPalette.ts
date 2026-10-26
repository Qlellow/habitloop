/**
 * 커맨드 팔레트 열기 (가벼운 부분만). 팔레트 화면(components/CommandPalette)은 처음 열 때 받는다
 */
export const OPEN_EVENT = 'loop:command-palette';
/** 헤더의 단축키 버튼 등 어디서든 커맨드 팔레트 열기 */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
