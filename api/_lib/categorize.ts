import { GoogleGenAI } from '@google/genai'
import { admin } from './supabase-admin'
import { env } from './env'
import { CATEGORIES, UNCATEGORIZED } from '../../src/data/categories'

/**
 * Two-stage categoriser.
 *
 *   1. A keyword lookup table (merchant substring → category), checked first.
 *      It starts empty and fills up as you notice patterns; a rule always
 *      beats the LLM and costs nothing.
 *   2. For anything unmatched, one Gemini call, memoised per normalised
 *      merchant string in merchant_categories. The same shop is never
 *      classified twice, so the steady-state cost is a call or two a week.
 *
 * Classification failure is never fatal: an unclassifiable merchant lands in
 * Uncategorized and the transaction still imports. Losing a category is a
 * nuisance; losing a transaction is a hole in the ledger.
 */

type Rule = { substring: string; category: string; priority: number }
type CacheRow = { merchant_key: string; category: string; source: string }

export type Categorizer = {
  categorize: (merchantKey: string, merchantRaw: string) => string
  /** True when at least one merchant was classified and cached this run. */
  learned: boolean
}

/**
 * Load the rules and the cache, classify every unknown merchant in one batch,
 * then hand back a synchronous lookup.
 *
 * Resolving up front rather than per-transaction keeps the sync loop free of
 * awaits and collapses what would be N API calls into one.
 */
export async function buildCategorizer(
  userId: string,
  merchants: { key: string; raw: string }[],
): Promise<Categorizer> {
  const [rules, cache] = await Promise.all([
    loadRules(userId),
    loadCache(userId),
  ])

  const resolved = new Map<string, string>(cache)
  const unknown: { key: string; raw: string }[] = []

  const seen = new Set<string>()
  for (const m of merchants) {
    if (!m.key || seen.has(m.key)) continue
    seen.add(m.key)
    if (resolved.has(m.key)) continue

    const byRule = matchRule(rules, m.key)
    if (byRule) {
      resolved.set(m.key, byRule)
      continue
    }
    unknown.push(m)
  }

  let learned = false
  if (unknown.length > 0) {
    const guessed = await classifyWithClaude(unknown)
    const rows: CacheRow[] = []
    for (const [key, category] of guessed) {
      resolved.set(key, category)
      rows.push({ merchant_key: key, category, source: 'llm' })
    }
    if (rows.length > 0) {
      learned = true
      // ignoreDuplicates so a hand-corrected 'manual' row is never clobbered
      // by a fresh guess for the same merchant.
      const { error } = await admin.from('merchant_categories').upsert(
        rows.map((r) => ({ user_id: userId, ...r })),
        { onConflict: 'user_id,merchant_key', ignoreDuplicates: true },
      )
      if (error) {
        console.error('[categorize] cache write failed:', error.message)
      }
    }
  }

  return {
    learned,
    categorize(key, raw) {
      if (!key) return UNCATEGORIZED
      return resolved.get(key) ?? matchRule(rules, raw) ?? UNCATEGORIZED
    },
  }
}

async function loadRules(userId: string): Promise<Rule[]> {
  const { data, error } = await admin
    .from('category_rules')
    .select('substring, category, priority')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
  if (error) throw new Error(`rule load failed: ${error.message}`)
  return ((data ?? []) as Rule[]).map((r) => ({
    ...r,
    substring: r.substring.toUpperCase(),
  }))
}

async function loadCache(userId: string): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from('merchant_categories')
    .select('merchant_key, category, source')
    .eq('user_id', userId)
  if (error) throw new Error(`merchant cache load failed: ${error.message}`)
  return new Map(
    ((data ?? []) as CacheRow[]).map((r) => [r.merchant_key, r.category]),
  )
}

/** First rule whose substring appears in the text; rules are priority-sorted. */
function matchRule(rules: Rule[], text: string): string | null {
  const haystack = text.toUpperCase()
  for (const r of rules) {
    if (haystack.includes(r.substring)) return r.category
  }
  return null
}

// ── the LLM fallback ─────────────────────────────────────────────────────

/**
 * Gemini constrains output to this schema, so `category` can only ever be one
 * of the known values.
 *
 * It is the OpenAPI 3.0 subset Gemini accepts — no `additionalProperties`,
 * which that subset does not define.
 */
const CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          merchant: { type: 'string' },
          category: { type: 'string', enum: [...CATEGORIES, UNCATEGORIZED] },
        },
        required: ['merchant', 'category'],
      },
    },
  },
  required: ['results'],
}

const SYSTEM_INSTRUCTION =
  'You categorise bank transaction descriptions from Swedish, Norwegian and ' +
  'EU card statements. The text is raw terminal output: abbreviated, ' +
  'sometimes truncated, often carrying a city or store number. Answer with ' +
  `exactly one category per input. Use "${UNCATEGORIZED}" only when the text ` +
  'gives you nothing to go on — prefer "Other" for a merchant you can read ' +
  'but cannot place.'

/** Batched so a first import of a year's history is a handful of calls. */
const BATCH_SIZE = 25

/**
 * Gemini 3.6 Flash — GA, cheap, and far stronger than this task needs, which
 * is the point: a misread merchant is a wrong number on the budget page.
 * `gemini-3.5-flash-lite` is the cheaper swap if the volume ever justifies it.
 */
const MODEL = 'gemini-3.6-flash'

async function classifyWithGemini(
  merchants: { key: string; raw: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()

  let client: GoogleGenAI
  try {
    client = new GoogleGenAI({ apiKey: env.geminiKey })
  } catch (e) {
    // No key configured — degrade to Uncategorized rather than fail the sync.
    console.error('[categorize] Gemini client unavailable:', String(e))
    return out
  }

  for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
    const batch = merchants.slice(i, i + BATCH_SIZE)
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents:
          'Categorise each of these merchant descriptions. Return one ' +
          'result per input, echoing the description back in `merchant`.\n\n' +
          batch.map((m) => `- ${m.raw}`).join('\n'),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: 2048,
          responseFormat: [
            { text: { mimeType: 'application/json', schema: CATEGORY_SCHEMA } },
          ],
        },
      })

      const finish = response.candidates?.[0]?.finishReason
      if (finish && finish !== 'STOP') {
        // Truncated or filtered — the JSON is probably half-written, and a
        // partial parse would assign categories from a torn-off list.
        console.error(`[categorize] batch ended with ${finish}; skipping`)
        continue
      }

      const text = response.text
      if (!text) continue
      const parsed = JSON.parse(text) as {
        results?: { merchant?: string; category?: string }[]
      }

      // Match answers back to inputs positionally, verifying the echo where we
      // can — a model that drops or reorders an entry must not shift every
      // subsequent merchant onto the wrong category.
      for (const [n, item] of (parsed.results ?? []).entries()) {
        const source = batch[n]
        if (!source || !item?.category) continue
        if (item.merchant && item.merchant.trim() !== source.raw.trim())
          continue
        out.set(source.key, item.category)
      }
    } catch (e) {
      // A failed batch just means those merchants stay uncategorised until the
      // next run picks them up again.
      console.error('[categorize] batch failed:', String(e))
    }
  }

  return out
}
