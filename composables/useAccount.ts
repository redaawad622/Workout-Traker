import Dexie from 'dexie'
import { Capacitor } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useDietStore } from '~/stores/diet'
import { MONEY_TABLE, type MoneyExpense } from '~/utils/money'

// Optional account: signing in with Google or Apple (through Supabase) backs up and syncs this
// device's log with the cloud. Without one the app works exactly as before, data on the device only.

export type Provider = 'google' | 'apple'
export type SyncState = 'idle' | 'syncing' | 'error'

// The iPhone app gets the sign-in result back on this URL (CFBundleURLTypes in ios/App/App/Info.plist).
const NATIVE_REDIRECT = 'com.redaawad.workoutlog://auth-callback'
const LAST_SYNC = 'lastSync'
// Meal prices waiting to reach Money Tracker (offline, or a failed upload); sent on the next sync.
const MONEY_OUTBOX = 'moneyOutbox'

const user = ref<{ id: string; email?: string; provider?: string } | null>(null)
const providers = ref<Provider[] | null>(null) // null until the project's settings load
const state = ref<SyncState>('idle')
const error = ref('')
const lastSync = ref<number | null>(null)
const busy = ref(false) // signing in
const offline = ref(false) // couldn't reach Supabase to see which sign-in options exist
const moneyCurrency = ref('') // Money Tracker's currency, shown next to meal prices

let client: SupabaseClient | null = null
let started = false
let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let quietUntil = 0

const native = () => Capacitor.isNativePlatform()

function config() {
  const c = useRuntimeConfig().public
  return { url: c.supabaseUrl as string, key: c.supabaseKey as string }
}

async function getClient() {
  if (client) return client
  const { createClient } = await import('@supabase/supabase-js')
  const { url, key } = config()
  client = createClient(url, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !native() }
  })
  return client
}

// Only offer the sign-in options turned on in the Supabase project.
async function loadProviders() {
  const { url, key } = config()
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    const ext = (await res.json())?.external ?? {}
    providers.value = (['apple', 'google'] as Provider[]).filter((p) => ext[p])
    offline.value = false
  } catch {
    offline.value = true
  }
}

type Outgoing = { uid: string; data: MoneyExpense }

function outbox(): Outgoing[] {
  try {
    return JSON.parse(localStorage.getItem(MONEY_OUTBOX) ?? '[]')
  } catch {
    return []
  }
}
function setOutbox(list: Outgoing[]) {
  try {
    localStorage.setItem(MONEY_OUTBOX, JSON.stringify(list))
  } catch {}
}

// Upserts by uid, so sending the same expense again (an edited price) updates it in Money Tracker.
async function flushMoney() {
  const box = outbox()
  if (!client || !user.value || !box.length) return
  const rows = box.map((o) => ({ user_id: user.value!.id, kind: 'expenses', uid: o.uid, data: o.data, deleted: false }))
  const { error: e } = await client.from(MONEY_TABLE).upsert(rows, { onConflict: 'user_id,kind,uid' })
  if (e) throw e
  const sent = new Set(box.map((o) => o.uid))
  setOutbox(outbox().filter((o) => !sent.has(o.uid)))
}

/** Queue an expense for Money Tracker and try to send it now. */
function sendToMoney(uid: string, data: MoneyExpense) {
  setOutbox([...outbox().filter((o) => o.uid !== uid), { uid, data }])
  flushMoney().catch(() => {})
}

async function loadMoneyCurrency() {
  if (!client || !user.value) return
  const { data } = await client.from(MONEY_TABLE).select('currency:data->>currency').eq('kind', 'settings').eq('uid', 'settings').maybeSingle()
  moneyCurrency.value = (data as { currency?: string } | null)?.currency ?? ''
}

async function runSync() {
  if (!client || !user.value) return
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    state.value = 'syncing'
    error.value = ''
    try {
      const { syncWith } = await import('~/utils/sync')
      const changed = await syncWith(client!, user.value!.id)
      if (changed) {
        const store = useWorkoutStore()
        await store.load()
        await useDietStore().load(store.latestBodyWeight)
      }
      // Meal prices for Money Tracker shouldn't fail the workout sync; they wait for the next one.
      await flushMoney().catch(() => {})
      if (!moneyCurrency.value) await loadMoneyCurrency().catch(() => {})
      lastSync.value = Date.now()
      try {
        localStorage.setItem(LAST_SYNC, String(lastSync.value))
      } catch {}
      state.value = 'idle'
    } catch (e: any) {
      state.value = 'error'
      error.value = navigator.onLine ? e?.message || 'Sync failed' : 'Offline. Will sync when you are back online.'
    } finally {
      quietUntil = Date.now() + 1500 // ignore the change events this sync's own writes cause
      running = null
    }
  })()
  await running
  if (again) {
    again = false
    await runSync()
  }
}

// Sync a few seconds after the last change, so a burst of logging uploads once.
function schedule(delay = 4000) {
  if (!user.value || running || Date.now() < quietUntil) return
  clearTimeout(timer)
  timer = setTimeout(runSync, delay)
}

async function onNativeUrl(url: string) {
  if (!url.startsWith(NATIVE_REDIRECT)) return
  const { Browser } = await import('@capacitor/browser')
  Browser.close().catch(() => {})
  const params = new URL(url.replace(NATIVE_REDIRECT, 'https://x/')).searchParams
  const code = params.get('code')
  busy.value = false
  if (!code) {
    error.value = params.get('error_description') || 'Sign-in was cancelled.'
    return
  }
  const { error: e } = await (await getClient()).auth.exchangeCodeForSession(code)
  if (e) error.value = e.message
}

// Called once the local stores have loaded, so a first sync never races the seed data.
async function start() {
  if (started || !import.meta.client || !config().url) return
  started = true
  try {
    const saved = Number(localStorage.getItem(LAST_SYNC))
    if (saved) lastSync.value = saved
  } catch {}
  loadProviders()

  const c = await getClient()
  c.auth.onAuthStateChange((event, session) => {
    const u = session?.user
    user.value = u ? { id: u.id, email: u.email, provider: u.app_metadata?.provider } : null
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      // Drop ?code=… left over from the web sign-in redirect.
      if (u && location.search.includes('code=')) history.replaceState(history.state, '', location.pathname)
      if (u) setTimeout(runSync, 0)
    }
  })

  if (native()) {
    const { App } = await import('@capacitor/app')
    App.addListener('appUrlOpen', ({ url }) => onNativeUrl(url))
    App.addListener('resume', () => schedule(500))
  } else {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule(500))
  }
  window.addEventListener('online', () => {
    if (offline.value) loadProviders()
    schedule(500)
  })
  // Only changes to your log count; the sync's own bookkeeping table never triggers another sync.
  Dexie.on('storagemutated', (parts) => {
    if (Object.keys(parts).some((k) => k.startsWith('idb://workout-log/') && !k.startsWith('idb://workout-log/synced/'))) schedule()
  })
}

async function signIn(provider: Provider) {
  error.value = ''
  busy.value = true
  const c = await getClient()
  if (native()) {
    // Google refuses sign-in inside an app's web view, so it opens in Safari's sheet and
    // comes back on the app's URL scheme.
    const { data, error: e } = await c.auth.signInWithOAuth({
      provider,
      options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true }
    })
    if (e || !data.url) {
      error.value = e?.message || 'Could not start sign-in.'
      busy.value = false
      return
    }
    const { Browser } = await import('@capacitor/browser')
    const done = await Browser.addListener('browserFinished', () => {
      busy.value = false
      done.remove()
    })
    await Browser.open({ url: data.url, presentationStyle: 'popover' })
  } else {
    const { error: e } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/data` } })
    if (e) {
      error.value = e.message
      busy.value = false
    }
  }
}

// Signing out keeps everything on this device; it only stops syncing.
async function signOut() {
  clearTimeout(timer)
  await client?.auth.signOut()
  user.value = null
  state.value = 'idle'
  // Forget the agreed versions so signing in again (to any account) merges instead of deleting.
  await useDb().synced.clear()
}

export function useAccount() {
  return {
    enabled: !!config().url,
    user: readonly(user),
    providers: readonly(providers),
    state: readonly(state),
    error: readonly(error),
    lastSync: readonly(lastSync),
    busy: readonly(busy),
    offline: readonly(offline),
    moneyCurrency: readonly(moneyCurrency),
    sendToMoney,
    start,
    signIn,
    signOut,
    syncNow: runSync,
    getClient
  }
}
