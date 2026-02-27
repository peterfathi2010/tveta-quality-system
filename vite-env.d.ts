
// Manually define Vite env types to avoid missing type definition errors
interface Window {
  aistudio: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly GEMINI_API_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_API_KEY: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    GEMINI_API_KEY: string;
    FIREBASE_API_KEY: string;
    VITE_FIREBASE_API_KEY: string;
    VITE_GOOGLE_CLIENT_ID: string;
    VITE_GOOGLE_API_KEY: string;
    NODE_ENV: string;
    [key: string]: string | undefined;
  }
}
