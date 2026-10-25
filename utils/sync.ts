import type { SupabaseClient } from '@supabase/supabase-js'
import type { Synced } from './db'

// Two-way sync between this device's Dexie tables and the signed-in user's rows in Supabase
// (table "records"). Local data stays the source of truth: a sync only ever deletes a local
// record when another device deleted it on purpose, and a record missing from the cloud is
// uploaded again, never removed here.

export type Kind = 'entries' | 'meals' | 'foods' | 'meta'
export const KINDS: Kind[] = ['entries', 'meals', 'foods', 'meta']
const LISTS: Kind[] = ['entries', 'meals', 'foods']

export interface Remote {
  kind: Kind
  uid: string
  data: unknown
  deleted: boolean
}

export interface Local {
  kind: Kind
  uid: string
  data: unknown // the record without its local id and uid; for meta, its value
  id?: number // local primary key (lists only)
}

export type Op =
  | { op: 'put'; kind: Kind; uid: string; data: unknown; id?: number }
  | { op: 'delete'; kind: Kind; uid: string; id?: number }
  | { op: 'rekey'; kind: Kind; id: number; uid: string }

export interface Plan {
  ops: Op[] // changes to make on this device
  push: Remote[] // changes to upload
  synced: Record<string, string | null> // agreed hash per "<kind>:<uid>" after the sync (null: absent)
}

// Same JSON for the same content, whatever the key order.
export function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`
}

// cyrb53: a small, fast 53-bit string hash.
export function hash(v: unknown): string {
  const s = stable(v)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

// Record content without the fields that differ per device.
export function content(row: Record<string, unknown>) {
  const { id, uid, ...rest } = row
  return rest
}

// Rows logged before sync existed get an id from their content, so the same seed or imported
// entry on the phone and on the web turns out to be one record, not two.
export function contentUid(data: unknown, taken: Set<string>) {
  const base = `c${hash(data)}`
  let n = 0
  while (taken.has(`${base}-${n}`)) n++
  const uid = `${base}-${n}`
  taken.add(uid)
  return uid
}

export const newUid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

// Settings that are maps or lists by id merge key by key; this device wins where both differ.
function mergeMeta(key: string, local: any, remote: any) {
  const isMap = (v: any) => v && typeof v === 'object' && !Array.isArray(v)
  if ((key === 'machineMax' || key === 'exerciseInfo') && isMap(local) && isMap(remote)) return { ...remote, ...local }
  if (key === 'programs' && Array.isArray(local) && Array.isArray(remote)) {
    const ids = new Set(local.map((p: any) => p?.id))
    return [...local, ...remote.filter((p: any) => !ids.has(p?.id))]
  }
  return local
}

export function plan(local: Local[], remote: Remote[], synced: Record<string, string>): Plan {
  const out: Plan = { ops: [], push: [], synced: {} }
  const L = new Map(local.map((r) => [`${r.kind}:${r.uid}`, r]))
  const R = new Map(remote.map((r) => [`${r.kind}:${r.uid}`, r]))
  const keys = new Set([...L.keys(), ...R.keys()])

  for (const key of keys) {
    const l = L.get(key)
    const r = R.get(key)
    const kind = (l ?? r)!.kind
    const uid = (l ?? r)!.uid
    const lHash = l ? hash(l.data) : null
    const rLive = r && !r.deleted ? r : undefined
    const rHash = rLive ? hash(rLive.data) : null
    const base = synced[key] ?? null

    if (lHash === rHash) {
      out.synced[key] = lHash
      continue
    }
    const localChanged = lHash !== base
    // A row missing from the cloud (not marked deleted) is never a reason to delete here.
    const remoteChanged = r ? rHash !== base : false

    const pushLocal = () => {
      out.push.push(l ? { kind, uid, data: l.data, deleted: false } : { kind, uid, data: null, deleted: true })
      out.synced[key] = lHash
    }
    const takeRemote = () => {
      if (rLive) out.ops.push({ op: 'put', kind, uid, data: rLive.data, id: l?.id })
      else out.ops.push({ op: 'delete', kind, uid, id: l?.id })
      out.synced[key] = rHash
    }

    if (localChanged && !remoteChanged) pushLocal()
    else if (remoteChanged && !localChanged) takeRemote()
    else if (!l) takeRemote() // deleted here, changed elsewhere: keep the change
    else if (!rLive) pushLocal() // changed here, deleted elsewhere: keep it
    else if (kind === 'meta') {
      const merged = mergeMeta(uid, l.data, rLive.data)
      const h = hash(merged)
      if (h !== lHash) out.ops.push({ op: 'put', kind, uid, data: merged })
      if (h !== rHash) out.push.push({ kind, uid, data: merged, deleted: false })
      out.synced[key] = h
    } else {
      // Both sides edited the same record: keep both rather than lose either.
      const fresh = newUid()
      out.ops.push({ op: 'rekey', kind, id: l.id!, uid: fresh })
      out.push.push({ kind, uid: fresh, data: l.data, deleted: false })
      out.synced[`${kind}:${fresh}`] = lHash
      out.ops.push({ op: 'put', kind, uid, data: rLive.data })
      out.synced[key] = rHash
    }
  }
  return out
}

async function pullAll(client: SupabaseClient): Promise<Remote[]> {
  const rows: Remote[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from('records')
      .select('kind, uid, data, deleted')
      .order('kind')
      .order('uid')
      .range(from, from + page - 1)
    if (error) throw error
    rows.push(...(data as Remote[]))
    if (data.length < page) return rows
  }
}

// Returns true when this device's data changed, so the stores need reloading.
export async function syncWith(client: SupabaseClient, userId: string): Promise<boolean> {
  const remote = await pullAll(client)
  const db = useDb()
  const tables = { entries: db.entries, meals: db.meals, foods: db.foods }

  let push: Remote[] = []
  let pushed: Synced[] = []
  const changed = await db.transaction('rw', [db.entries, db.meals, db.foods, db.meta, db.synced], async () => {
    const local: Local[] = []
    const ops: Op[] = []
    for (const kind of LISTS) {
      const rows = (await tables[kind].toArray()) as Record<string, any>[]
      const taken = new Set(rows.map((r) => r.uid).filter(Boolean) as string[])
      for (const row of rows.sort((a, b) => a.id - b.id)) {
        const data = content(row)
        let uid = row.uid as string | undefined
        if (!uid) {
          uid = contentUid(data, taken)
          ops.push({ op: 'rekey', kind, id: row.id, uid })
        }
        local.push({ kind, uid, data, id: row.id })
      }
    }
    for (const m of await db.meta.toArray()) local.push({ kind: 'meta', uid: m.key, data: m.value })

    const synced: Record<string, string> = {}
    for (const s of await db.synced.toArray()) synced[s.id] = s.hash

    const p = plan(local, remote, synced)
    ops.push(...p.ops)
    for (const op of ops) {
      if (op.kind === 'meta') {
        if (op.op === 'put') await db.meta.put({ key: op.uid, value: op.data })
        else if (op.op === 'delete') await db.meta.delete(op.uid)
        continue
      }
      const table = tables[op.kind] as any
      if (op.op === 'rekey') await table.update(op.id, { uid: op.uid })
      else if (op.op === 'delete') op.id !== undefined && (await table.delete(op.id))
      else if (op.id !== undefined) await table.put({ ...(op.data as object), uid: op.uid, id: op.id })
      else await table.add({ ...(op.data as object), uid: op.uid })
    }

    // Records about to be uploaded are marked agreed only once the upload succeeds.
    const pending = new Set(p.push.map((r) => `${r.kind}:${r.uid}`))
    for (const [id, h] of Object.entries(p.synced)) {
      if (pending.has(id)) {
        if (h !== null) pushed.push({ id, hash: h })
        continue
      }
      if (h === null) await db.synced.delete(id)
      else await db.synced.put({ id, hash: h })
    }
    push = p.push
    return ops.length > 0
  })

  for (let i = 0; i < push.length; i += 500) {
    const chunk = push.slice(i, i + 500).map((r) => ({ ...r, user_id: userId }))
    const { error } = await client.from('records').upsert(chunk, { onConflict: 'user_id,kind,uid' })
    if (error) throw error
  }
  await db.synced.bulkPut(pushed)
  await db.synced.bulkDelete(push.filter((r) => r.deleted).map((r) => `${r.kind}:${r.uid}`))
  return changed
}
