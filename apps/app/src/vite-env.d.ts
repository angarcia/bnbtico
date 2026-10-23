/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

/** Identificador del build (vite.config.ts): invalida la caché persistida de Query en cada despliegue. */
declare const __BUILD_ID__: string;
