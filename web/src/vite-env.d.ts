/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

/** 빌드한 커밋 (vite.config.ts 의 define) */
declare const __RELEASE__: string;
