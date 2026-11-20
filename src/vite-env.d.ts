/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AdSense publisher id baked in at build time (`ca-pub-…`). */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** `1` forces test ads (data-adtest=on) — use on preview deployments. */
  readonly VITE_ADSENSE_TEST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
