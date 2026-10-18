// ============================================================
//  DATA LAYER  –  Supabase backend.
//  UI sirf in functions ko call karta hai. Setup: BACKEND_GUIDE.md
// ============================================================
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// Public https URL (deployed app). Iske baghair link localhost par banega.
const configuredAppUrl = (import.meta.env.VITE_APP_URL || '').replace(/\/+$/, '')

export const configured = Boolean(url && anonKey)

export const sb = configured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

export const publicBaseUrl =
  configuredAppUrl || (typeof location !== 'undefined' ? location.origin + location.pathname : '')

// Share karne layak link? (https + localhost nahi)
export const isShareable = /^https:\/\//i.test(publicBaseUrl) && !/\/\/(localhost|127\.0\.0\.1)/i.test(publicBaseUrl)

function needClient() {
  if (!sb) throw new Error('Supabase is not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.')
}

function fail(where, error) {
  const msg = error?.message || String(error)
  console.error(`[api.${where}]`, error)
  if (/relation .*does not exist/i.test(msg) || /Could not find the table/i.test(msg)) {
    throw new Error('Database tables are missing — run the SQL in supabase/schema.sql.')
  }
  if (/row-level security/i.test(msg)) {
    throw new Error('Blocked by row-level security — run the latest policies in supabase/schema.sql.')
  }
  if (/Invalid API key|JWT|Invalid login credentials/i.test(msg)) {
    throw /credentials/i.test(msg) ? new Error('Incorrect email or password.') : new Error('Invalid anon key — check your .env file.')
  }
  if (/already registered/i.test(msg)) throw new Error('This email is already registered — sign in instead.')
  if (/at least 6 characters/i.test(msg)) throw new Error('Password must be at least 6 characters.')
  if (/Email not confirmed/i.test(msg)) throw new Error('Email not confirmed — check your inbox or confirm the user in the dashboard.')
  if (/rate limit|too many requests/i.test(msg)) {
    throw new Error('Email rate limit exceeded. Supabase limits confirmation emails — turn off "Confirm email" (Authentication → Providers → Email), add the user manually in Authentication → Users, or wait about an hour.')
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    throw new Error('Could not reach Supabase — check the project URL and your connection.')
  }
  // Trigger validation / Postgres messages ko as-is dikhao
  throw new Error(msg)
}

const toRow = (r) => ({ id: r.id, createdAt: r.created_at, data: r.data || {} })
const toForm = (f) => ({
  id: f.id,
  title: f.title || 'Untitled form',
  instructions: f.instructions || '',
  fields: f.fields || [],
  sample: f.sample || {},
})

export const auth = {
  async session() {
    needClient()
    const { data } = await sb.auth.getSession()
    return data.session
  },
  async signIn(email, password) {
    needClient()
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) fail('signIn', error)
  },
  /** Signup. Agar email confirmation ON hai to session null aata hai. */
  async signUp(email, password) {
    needClient()
    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) fail('signUp', error)
    return data.session
  },
  async signOut() {
    needClient()
    await sb.auth.signOut()
  },
  onChange(cb) {
    if (!sb) return { data: { subscription: { unsubscribe() {} } } }
    return sb.auth.onAuthStateChange((_event, session) => cb(session))
  },
}

export const api = {
  /** Shareable link for a form. */
  buildLink(id) {
    return `${publicBaseUrl}?form=${id}`
  },

  /** Teacher: meri class rooms. */
  async listRooms() {
    needClient()
    const { data, error } = await sb
      .from('rooms')
      .select('id, name, subject, created_at')
      .order('created_at', { ascending: false })
    if (error) fail('listRooms', error)
    return data || []
  },

  /** Teacher: naya class room. */
  async createRoom({ name, subject }) {
    needClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) throw new Error('Please sign in to create a class room.')
    const { data, error } = await sb
      .from('rooms')
      .insert({ name: name.trim(), subject: (subject || '').trim() || null, teacher_id: session.user.id })
      .select()
      .single()
    if (error) fail('createRoom', error)
    return data
  },

  /** Teacher: room delete (uske forms + responses bhi cascade delete). */
  async deleteRoom(id) {
    needClient()
    const { error } = await sb.from('rooms').delete().eq('id', id)
    if (error) fail('deleteRoom', error)
  },

  /** Teacher: ek room ki forms. */
  async listForms(roomId) {
    needClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) throw new Error('Please sign in.');
    const { data, error } = await sb
      .from('forms')
      .select('id, title, created_at')
      .eq('room_id', roomId)
      .eq('owner', session.user.id)
      .order('created_at', { ascending: false })
    if (error) fail('listForms', error)
    return data || []
  },

  /** Teacher: save the form (insert first time, update after). Returns { id, link }. */
  async publishForm(f) {
    needClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) throw new Error('Please sign in to publish a form.')

    const payload = {
      title: f.title,
      instructions: f.instructions,
      fields: f.fields,
      sample: f.sample || {},
      owner: session.user.id,
    }
    if (f.room_id) payload.room_id = f.room_id

    const query = f.id
      ? sb.from('forms').update(payload).eq('id', f.id)
      : sb.from('forms').insert(payload)

    const { data, error } = await query.select().single()
    if (error) fail('publishForm', error)
    return { id: data.id, link: `${publicBaseUrl}?form=${data.id}` }
  },

  /** Student: load a form by id. Returns null when the link is invalid/deleted. */
  async getForm(id) {
    needClient()
    const { data, error } = await sb
      .from('forms')
      .select('id, title, instructions, fields, sample')
      .eq('id', id)
      .single()
    if (error) {
      if (error.code === 'PGRST116' || /0 rows/i.test(error.message)) return null
      fail('getForm', error)
    }
    return toForm(data)
  },

  /** Student: teacher ki form edits live receive karo. */
  subscribeForm(formId, cb) {
    needClient()
    const channel = sb
      .channel('form-' + formId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'forms', filter: `id=eq.${formId}` },
        (payload) => cb(toForm(payload.new))
      )
      .subscribe()
    return () => sb.removeChannel(channel)
  },

  /** Teacher: live submissions. Returns an unsubscribe function. */
  subscribe(formId, cb) {
    needClient()
    const rows = new Map()
    const emit = () => cb(
      [...rows.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    )

    sb.from('submissions')
      .select('id, form_id, data, created_at')
      .eq('form_id', formId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[api.subscribe]', error.message)
          return emit()
        }
        ;(data || []).forEach((r) => rows.set(r.id, toRow(r)))
        emit()
      })

    const channel = sb
      .channel('subs-' + formId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions', filter: `form_id=eq.${formId}` },
        (payload) => {
          rows.set(payload.new.id, toRow(payload.new))
          emit()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'submissions', filter: `form_id=eq.${formId}` },
        (payload) => {
          rows.delete(payload.old?.id)
          emit()
        }
      )
      .subscribe()

    return () => sb.removeChannel(channel)
  },

  /** Student: submit one row. Timestamp aur validation DB side hoti hai. */
  async submit(formId, data) {
    needClient()
    const { error } = await sb.from('submissions').insert({ form_id: formId, data })
    if (error) fail('submit', error)
  },

  /** Teacher: ek response delete karo. */
  async deleteSubmission(id) {
    needClient()
    const { error } = await sb.from('submissions').delete().eq('id', id)
    if (error) fail('deleteSubmission', error)
  },

  /** Teacher: form aur uske saare responses delete karo. */
  async deleteForm(id) {
    needClient()
    const { error } = await sb.from('forms').delete().eq('id', id)
    if (error) fail('deleteForm', error)
  },
}
