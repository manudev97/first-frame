/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_HALLIDAY_API_KEY: string;
  readonly VITE_STORY_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

