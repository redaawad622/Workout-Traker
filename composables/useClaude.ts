import { Capacitor } from '@capacitor/core'
import type { AiExercise, AiFood, AiKind } from '~/utils/ai'

// Optional "Ask Claude" fill for foods and exercises the app doesn't know.
// The website calls its own /api route; the iPhone app has no server, so it calls the website.
// Everything still works by hand without it (offline, or before it's set up).
const SITE = 'https://workout-traker.vercel.app'
const PASSCODE_KEY = 'aiPasscode'

export async function getAiPasscode() {
  return ((await useDb().meta.get(PASSCODE_KEY))?.value as string | undefined) ?? ''
}
export async function setAiPasscode(code: string) {
  const db = useDb()
  if (code) await db.meta.put({ key: PASSCODE_KEY, value: code })
  else await db.meta.delete(PASSCODE_KEY)
}

async function ask<T>(kind: AiKind, query: string): Promise<T> {
  if (!navigator.onLine) throw new Error("You're offline. Fill it in by hand.")
  let passcode = await getAiPasscode()
  if (!passcode) {
    passcode = (prompt('Claude passcode (the AI_PASSCODE you set in Vercel). Saved on this phone.') ?? '').trim()
    if (!passcode) throw new Error('No passcode, nothing was sent.')
    await setAiPasscode(passcode)
  }
  const base = Capacitor.isNativePlatform() ? SITE : ''
  let res: Response
  try {
    res = await fetch(`${base}/api/ai/fill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-passcode': passcode },
      body: JSON.stringify({ kind, query })
    })
  } catch {
    throw new Error("Couldn't reach Claude. Fill it in by hand.")
  }
  if (res.status === 401) {
    await setAiPasscode('') // ask again next time
    throw new Error('Wrong passcode. Try again to enter it.')
  }
  if (!res.ok) {
    const msg = await res.json().then((j) => j?.statusMessage || j?.message).catch(() => '')
    throw new Error(msg || `Claude didn't answer (${res.status}).`)
  }
  return res.json()
}

export const useClaude = () => ({
  fillFood: (name: string) => ask<AiFood>('food', name),
  fillExercise: (name: string) => ask<AiExercise>('exercise', name)
})
