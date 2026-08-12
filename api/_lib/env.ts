/**
 * Every secret the sync job needs, read once and validated loudly.
 *
 * None of these are `VITE_`-prefixed, so Vite never inlines them into the
 * browser bundle — they exist only in the Vercel function environment.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `Missing ${name}. Set it with \`vercel env add ${name}\` (or in Project ` +
        'Settings → Environment Variables) and redeploy.',
    )
  }
  return v
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

export const env = {
  get supabaseUrl() {
    return required('SUPABASE_URL')
  },
  /** Bypasses RLS. Server-side only — never expose this to the client. */
  get supabaseServiceKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
  /**
   * The single account the importer writes to. Every table is keyed on
   * user_id, so an unattended job has to be told which user it is acting as.
   * Find it in Supabase → Authentication → Users.
   */
  get userId() {
    return required('SLOWSTREAK_USER_ID')
  },

  get ebApplicationId() {
    return required('ENABLE_BANKING_APP_ID')
  },
  /**
   * The RSA private key downloaded when the app was registered. Newlines
   * survive round-tripping through env vars badly, so `\n` escapes are
   * accepted and unescaped here.
   */
  get ebPrivateKey() {
    return required('ENABLE_BANKING_PRIVATE_KEY').replace(/\\n/g, '\n')
  },
  get ebBaseUrl() {
    return optional('ENABLE_BANKING_BASE_URL', 'https://api.enablebanking.com')
  },
  /** Must match a redirect URL registered in the Control Panel exactly. */
  get ebRedirectUrl() {
    return required('ENABLE_BANKING_REDIRECT_URL')
  },

  get anthropicKey() {
    return required('ANTHROPIC_API_KEY')
  },

  /** Set automatically by Vercel Cron; also required on manual invocations. */
  get cronSecret() {
    return required('CRON_SECRET')
  },

  get fxBaseUrl() {
    return optional('FX_BASE_URL', 'https://api.frankfurter.dev/v1')
  },
  /** Everything is reported in this currency on the budget page. */
  homeCurrency: 'SEK',
}
