/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** 카카오톡 공유용 JavaScript 키 (카카오 개발자 콘솔 → 앱 키). 없으면 카카오톡 버튼을 숨긴다 */
  readonly VITE_KAKAO_JS_KEY?: string;
}
