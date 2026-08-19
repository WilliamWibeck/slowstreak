/// <reference types="vite/client" />

type ImportMetaEnv = {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** The only account the landing page will try. Ships in the bundle. */
  readonly VITE_OWNER_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
