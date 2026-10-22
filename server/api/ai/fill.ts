import Anthropic from '@anthropic-ai/sdk'
import type { AiExercise, AiFood } from '~/utils/ai'

// Asks Claude for the details of a food or exercise the app doesn't know.
// Runs on Vercel only: ANTHROPIC_API_KEY never reaches the phone. AI_PASSCODE stops
// strangers who find the URL from spending the key; the app sends it in x-app-passcode.

const MODEL = 'claude-opus-5-5'

const n = { type: 'number' }
const FOOD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    ar: { type: 'string' },
    per100: {
      type: 'object',
      properties: { kcal: n, protein: n, carbs: n, fat: n, fiber: n, sugar: n, sodium: n },
      required: ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'],
      additionalProperties: false
    },
    servingG: n,
    servingLabel: { type: 'string' },
    note: { type: 'string' }
  },
  required: ['name', 'ar', 'per100', 'servingG', 'servingLabel', 'note'],
  additionalProperties: false
}

const EXERCISE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    splitDay: { type: 'string', enum: ['push', 'pull', 'legs'] },
    muscles: { type: 'array', items: { type: 'string' } },
    equipment: { type: 'string', enum: ['machine', 'cable', 'dumbbells', 'barbell', 'bodyweight', 'other'] },
    perDumbbell: { type: 'boolean' },
    tip: { type: 'string' }
  },
  required: ['name', 'splitDay', 'muscles', 'equipment', 'perDumbbell', 'tip'],
  additionalProperties: false
}

const PROMPTS = {
  food: `You fill in nutrition facts for a personal diet log used in Egypt. Given a food or meal name (English, Arabic or Franco-Arabic), return values per 100 g as eaten (cooked where that applies), using USDA averages for plain foods and a typical home recipe for dishes. Sodium is in mg, everything else in g except kcal. Give a common serving in grams with a short label (plate, piece, cup, sandwich…). Use a clear English name and the usual Egyptian Arabic name in "ar" (empty if none). In "note", say in one short sentence what you assumed, such as the recipe or portion.`,
  exercise: `You classify gym exercises for a workout log with a push / pull / legs split. Given an exercise name, return a tidy English name in the log's style: the movement, then " — " and the equipment when it matters (e.g. "Hammer Curl — Dumbbells", "Lat Pulldown", "Leg Press"). Pick the split day it belongs to (push = chest, shoulders, triceps; pull = back, rear delts, biceps; legs = legs, glutes, calves; core goes on legs). List the main muscles worked, main first, in plain words. Set perDumbbell true only when the weight is normally one dumbbell per hand. Give one short form cue in "tip".`
}

let client: Anthropic | null = null

export default defineEventHandler(async (event) => {
  // The iPhone app runs from capacitor://localhost, so allow cross-origin calls.
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-app-passcode'
  })
  if (event.method === 'OPTIONS') return ''
  if (event.method !== 'POST') throw createError({ statusCode: 405 })

  const key = process.env.ANTHROPIC_API_KEY
  const passcode = process.env.AI_PASSCODE
  if (!key || !passcode) throw createError({ statusCode: 503, statusMessage: 'Claude is not set up on the server yet' })
  if (getHeader(event, 'x-app-passcode') !== passcode) throw createError({ statusCode: 401, statusMessage: 'Wrong passcode' })

  const body = await readBody<{ kind?: string; query?: string }>(event)
  const kind = body?.kind === 'food' || body?.kind === 'exercise' ? body.kind : null
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 120) : ''
  if (!kind || !query) throw createError({ statusCode: 400, statusMessage: 'Send a kind and a name' })

  client ??= new Anthropic({ apiKey: key })
  let response
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: kind === 'food' ? FOOD_SCHEMA : EXERCISE_SCHEMA } },
      system: PROMPTS[kind],
      messages: [{ role: 'user', content: query }]
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw createError({ statusCode: 502, statusMessage: 'The Anthropic API key was rejected' })
    if (err instanceof Anthropic.RateLimitError) throw createError({ statusCode: 429, statusMessage: 'Claude is busy, try again in a minute' })
    if (err instanceof Anthropic.APIError) throw createError({ statusCode: 502, statusMessage: `Claude error ${err.status ?? ''}`.trim() })
    throw createError({ statusCode: 502, statusMessage: 'Could not reach Claude' })
  }

  if (response.stop_reason === 'refusal') throw createError({ statusCode: 422, statusMessage: 'Claude would not answer that one' })
  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw createError({ statusCode: 502, statusMessage: 'Claude sent no answer' })
  const data = JSON.parse(text.text)
  return kind === 'food' ? cleanFood(data) : cleanExercise(data)
})

const num = (v: unknown, max: number) => (typeof v === 'number' && isFinite(v) ? Math.min(Math.max(v, 0), max) : 0)
const round1 = (v: number) => Math.round(v * 10) / 10

function cleanFood(d: any): AiFood {
  const p = d.per100 ?? {}
  return {
    name: String(d.name ?? '').slice(0, 80),
    ar: String(d.ar ?? '').slice(0, 80),
    per100: {
      kcal: Math.round(num(p.kcal, 900)),
      protein: round1(num(p.protein, 100)),
      carbs: round1(num(p.carbs, 100)),
      fat: round1(num(p.fat, 100)),
      fiber: round1(num(p.fiber, 100)),
      sugar: round1(num(p.sugar, 100)),
      sodium: Math.round(num(p.sodium, 40000))
    },
    servingG: Math.round(num(d.servingG, 2000)),
    servingLabel: String(d.servingLabel ?? '').slice(0, 30),
    note: String(d.note ?? '').slice(0, 240)
  }
}

function cleanExercise(d: any): AiExercise {
  return {
    name: String(d.name ?? '').slice(0, 80),
    splitDay: ['push', 'pull', 'legs'].includes(d.splitDay) ? d.splitDay : 'push',
    muscles: Array.isArray(d.muscles) ? d.muscles.map(String).slice(0, 5) : [],
    equipment: ['machine', 'cable', 'dumbbells', 'barbell', 'bodyweight', 'other'].includes(d.equipment) ? d.equipment : 'other',
    perDumbbell: !!d.perDumbbell,
    tip: String(d.tip ?? '').slice(0, 200)
  }
}
