import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env.js'

/**
 * The OAuth `state` round-tripped through the bank.
 *
 * Signed rather than stored: it only has to survive one redirect, and an HMAC
 * over "which bank, issued when" needs no table and no cleanup job. The
 * signature is what stops a stranger who finds the callback URL from binding
 * an arbitrary `code` to one of your accounts.
 */

const TTL_MS = 30 * 60 * 1000

export function signState(slug: string): string {
  const payload = `${slug}.${Date.now()}`
  return `${payload}.${mac(payload)}`
}

export function verifyState(state: string): { slug: string } | null {
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [slug, issued, signature] = parts as [string, string, string]

  const expected = mac(`${slug}.${issued}`)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const age = Date.now() - Number(issued)
  if (!Number.isFinite(age) || age < 0 || age > TTL_MS) return null

  return { slug }
}

/** Constant-time comparison for the shared secret guarding /api/connect/start. */
export function secretMatches(candidate: string | undefined): boolean {
  if (!candidate) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(env.cronSecret)
  return a.length === b.length && timingSafeEqual(a, b)
}

function mac(payload: string): string {
  return createHmac('sha256', env.cronSecret).update(payload).digest('hex')
}
