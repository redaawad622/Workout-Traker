import { Capacitor } from '@capacitor/core'

// Paid plans, hidden until turned on remotely: the `workout_subscription` row of public.app_config
// in Supabase. Once on, each person gets graceDays of notice from the first time their app sees it,
// then the app asks them to subscribe. Nothing is ever deleted or locked away: Account & data
// (/data) stays open, so anyone can export their log or sign in without paying.

export interface SubConfig {
  enabled: boolean
  native: boolean // also ask in the iPhone app (Apple may require in-app purchase there)
  graceDays: number
  currency: string
  monthlyPrice: number
  yearlyPrice: number
  monthlyUrl: string // Stripe Payment Link
  yearlyUrl: string
}
export type Phase = 'off' | 'active' | 'notice' | 'due'

const OFF: SubConfig = {
  enabled: false,
  native: false,
  graceDays: 7,
  currency: 'USD',
  monthlyPrice: 1,
  yearlyPrice: 10,
  monthlyUrl: '',
  yearlyUrl: ''
}
const CONFIG_KEY = 'subscriptionConfig'
const NOTICE_KEY = 'subscriptionNoticeAt'
const PAID_KEY = 'subscriptionPaid' // last known subscription, so the app doesn't ask again offline
const DAY = 86400000

const config = ref<SubConfig>(OFF)
const noticeAt = ref<number | null>(null)
const paid = ref<{ user: string; until: number | null } | null>(null) // until null: no end (lifetime)
const now = ref(Date.now())
const sheet = ref(false) // plans sheet open
const checking = ref(false)

let started = false

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}
function write(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {}
}

function parse(v: any): SubConfig {
  const num = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) ? x : d)
  return {
    enabled: v?.enabled === true,
    native: v?.native === true,
    graceDays: num(v?.grace_days, OFF.graceDays),
    currency: typeof v?.currency === 'string' ? v.currency : OFF.currency,
    monthlyPrice: num(v?.monthly_price, OFF.monthlyPrice),
    yearlyPrice: num(v?.yearly_price, OFF.yearlyPrice),
    monthlyUrl: typeof v?.monthly_url === 'string' ? v.monthly_url : '',
    yearlyUrl: typeof v?.yearly_url === 'string' ? v.yearly_url : ''
  }
}

const applies = computed(() => config.value.enabled && (config.value.native || !Capacitor.isNativePlatform()))

const subscribed = computed(() => {
  const user = useAccount().user.value
  const p = paid.value
  return !!user && !!p && p.user === user.id && (p.until === null || p.until > now.value)
})

const phase = computed<Phase>(() => {
  if (!applies.value) return 'off'
  if (subscribed.value) return 'active'
  if (noticeAt.value !== null && now.value < noticeAt.value + config.value.graceDays * DAY) return 'notice'
  return 'due'
})

const daysLeft = computed(() =>
  noticeAt.value === null ? config.value.graceDays : Math.max(0, Math.ceil((noticeAt.value + config.value.graceDays * DAY - now.value) / DAY))
)

// Read with the public key over REST, so people who never sign in don't load the Supabase client.
// Offline, the last settings seen stay in force; never fetched means off.
async function loadConfig() {
  const c = useRuntimeConfig().public
  if (!c.supabaseUrl) return
  try {
    const res = await fetch(`${c.supabaseUrl}/rest/v1/app_config?key=eq.workout_subscription&select=value`, {
      headers: { apikey: c.supabaseKey as string }
    })
    if (!res.ok) return
    const rows = await res.json()
    config.value = parse(rows?.[0]?.value)
    write(CONFIG_KEY, rows?.[0]?.value ?? null)
  } catch {}
  now.value = Date.now()
  if (!applies.value) {
    // Turned off again: start a fresh notice period if it's ever turned back on.
    noticeAt.value = null
    write(NOTICE_KEY, null)
  } else if (noticeAt.value === null) {
    noticeAt.value = now.value
    write(NOTICE_KEY, now.value)
    if (!subscribed.value) sheet.value = true // tell them once, the first time
  }
}

async function loadPaid() {
  const account = useAccount()
  const user = account.user.value
  if (!user) return
  checking.value = true
  try {
    const client = await account.getClient()
    const { data, error } = await client.from('workout_subscriptions').select('plan, status, current_period_end').eq('user_id', user.id).maybeSingle()
    if (error) return
    const ok = data && (data.plan === 'lifetime' || ['active', 'trialing', 'past_due'].includes(data.status))
    paid.value = ok ? { user: user.id, until: data.current_period_end ? Date.parse(data.current_period_end) : null } : null
    write(PAID_KEY, paid.value)
  } catch {
  } finally {
    checking.value = false
    now.value = Date.now()
  }
}

function refresh() {
  loadConfig()
  loadPaid()
}

function start() {
  if (started || !import.meta.client) return
  started = true
  const cached = read<unknown>(CONFIG_KEY)
  if (cached) config.value = parse(cached)
  noticeAt.value = read<number>(NOTICE_KEY)
  paid.value = read(PAID_KEY)
  loadConfig()
  watch(() => useAccount().user.value?.id, (id) => id && loadPaid(), { immediate: true })
  // Coming back from the checkout page (or a day later) re-checks.
  setInterval(() => (now.value = Date.now()), 60 * 60 * 1000)
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => App.addListener('resume', refresh))
  } else {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh())
  }
}

function price(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: config.value.currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n)
  } catch {
    return `${n} ${config.value.currency}`
  }
}

/** Opens the plan's checkout, tagged with the account so the payment is matched to it. */
async function checkout(plan: 'monthly' | 'yearly') {
  const user = useAccount().user.value
  const base = plan === 'monthly' ? config.value.monthlyUrl : config.value.yearlyUrl
  if (!user || !base) return
  const url = new URL(base)
  url.searchParams.set('client_reference_id', user.id)
  if (user.email) url.searchParams.set('prefilled_email', user.email)
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: url.toString() })
  } else {
    location.href = url.toString()
  }
}

export function useSubscription() {
  return {
    config: readonly(config),
    phase,
    daysLeft,
    sheet,
    checking: readonly(checking),
    start,
    refresh,
    checkPaid: loadPaid,
    checkout,
    price
  }
}
