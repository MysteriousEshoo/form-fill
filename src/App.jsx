import React, { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Table2, GraduationCap, Plus, Trash2, Rocket, Download, FileText, Copy,
  CheckCircle2, X, Radio, Send, Info, Sparkles, LogOut, Loader2, ShieldAlert, FolderOpen,
  ArrowLeft, KeyRound,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { api, auth, configured, isShareable } from './api'

// ---------- Field types ----------
const TYPES = {
  text:  { label: 'Text',    input: 'text',  ph: 'Enter text',        sample: 'Ali Raza' },
  email: { label: 'Email',   input: 'email', ph: 'name@example.com',  sample: 'ali@uni.edu' },
  roll:  { label: 'Roll No', input: 'text',  ph: 'e.g. CS-21-001',    sample: 'CS-21-001' },
  phone: { label: 'Phone',   input: 'tel',   ph: '03XX-XXXXXXX',      sample: '0300-1234567' },
}
const uid = () => 'f' + Math.random().toString(36).slice(2, 7)
const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-lg active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0'
const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md'

export default function App() {
  const formIdFromUrl = new URLSearchParams(location.search).get('form')
  const isStudent = !!formIdFromUrl
  const [session, setSession] = useState(isStudent ? null : undefined) // undefined = checking
  const [toasts, setToasts] = useState([])
  const [form, setForm] = useState({ title: '', instructions: '', fields: [], sample: {} })
  const [formId, setFormId] = useState(formIdFromUrl || null)
  const [studentState, setStudentState] = useState(isStudent ? 'loading' : 'idle')

  const toast = useCallback((msg, kind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  // Teacher session (student link ko login ki zaroorat nahi)
  useEffect(() => {
    if (isStudent) return
    if (!configured) { setSession(null); return }
    let alive = true
    auth.session().then((s) => alive && setSession(s)).catch(() => alive && setSession(null))
    const { data } = auth.onChange((s) => alive && setSession(s))
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [isStudent])

  // Student: form load + teacher ki live edits
  useEffect(() => {
    if (!isStudent) return
    let alive = true
    api.getForm(formIdFromUrl)
      .then((f) => {
        if (!alive) return
        if (!f) { setStudentState('notfound'); return }
        setForm({ title: f.title, instructions: f.instructions, fields: f.fields, sample: f.sample })
        setStudentState('ready')
      })
      .catch((e) => { if (alive) { toast(e.message, 'error'); setStudentState('notfound') } })
    return () => { alive = false }
  }, [isStudent, formIdFromUrl, toast])

  useEffect(() => {
    if (!isStudent || studentState !== 'ready' || !formId) return
    try {
      return api.subscribeForm(formId, (f) => {
        setForm({ title: f.title, instructions: f.instructions, fields: f.fields, sample: f.sample })
      })
    } catch (e) {
      toast(e.message, 'error')
    }
  }, [isStudent, studentState, formId, toast])

  const toastsView = (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-in flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${t.kind === 'error' ? 'bg-rose-600' : t.kind === 'info' ? 'bg-slate-800' : 'bg-emerald-600'}`}>
          <CheckCircle2 size={16} />{t.msg}
          <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X size={14} /></button>
        </div>
      ))}
    </div>
  )

  // ---------- Student-only view (?form=ID) ----------
  if (isStudent) {
    return (
      <div className="min-h-screen p-4 sm:p-8">
        {studentState === 'loading' && <CenterCard><Loader2 className="animate-spin text-indigo-600" size={32} /><p className="text-slate-500">Loading form…</p></CenterCard>}
        {studentState === 'notfound' && (
          <CenterCard>
            <ShieldAlert className="text-rose-500" size={44} />
            <h1 className="text-xl font-bold">Form not found</h1>
            <p className="text-slate-500">This link is invalid or the form was deleted. Please ask your teacher for a new link.</p>
          </CenterCard>
        )}
        {studentState === 'ready' && <Student form={form} toast={toast} formId={formId} solo />}
        {toastsView}
      </div>
    )
  }

  if (!configured) {
    return (
      <CenterCard>
        <ShieldAlert className="text-amber-500" size={44} />
        <h1 className="text-xl font-bold">Supabase is not configured</h1>
        <p className="text-slate-500">Add <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to the <code className="font-mono">.env</code> file in the project root, then restart <code className="font-mono">npm run dev</code>.</p>
      </CenterCard>
    )
  }

  if (session === undefined) {
    return <CenterCard><Loader2 className="animate-spin text-indigo-600" size={32} /><p className="text-slate-500">Loading…</p></CenterCard>
  }

  return (
    <>
      {session ? <Workspace session={session} toast={toast} /> : <AuthPanel toast={toast} />}
      {toastsView}
    </>
  )
}

function CenterCard({ children }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-3 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">{children}</div>
    </div>
  )
}

/* ============================ AUTH PANEL ============================ */
function AuthPanel({ toast }) {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (mode === 'login') {
        await auth.signIn(email.trim(), password)
        toast('Welcome back!')
      } else {
        const session = await auth.signUp(email.trim(), password)
        toast(session ? 'Account created 🎉' : 'Account created — confirm your email, then sign in.', session ? 'success' : 'info')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white"><Sparkles size={20} /></div>
          <div><h1 className="text-lg font-bold">FormFlow</h1><p className="text-xs text-slate-500">Teacher workspace</p></div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {['login', 'signup'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {m === 'login' ? 'Login' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold">Email
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls + ' mt-1.5 font-normal'} placeholder="teacher@uni.edu" />
          </label>
          <label className="block text-sm font-semibold">Password
            <input required type="password" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + ' mt-1.5 font-normal'} placeholder="At least 6 characters" />
          </label>
          {mode === 'signup' && (
            <label className="block text-sm font-semibold">Confirm password
              <input required type="password" minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls + ' mt-1.5 font-normal'} placeholder="Re-enter password" />
            </label>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />{error}
            </p>
          )}

          <button disabled={busy} className={btnPrimary + ' w-full py-3'}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">Only teachers need an account. Students fill in forms from the link without signing in.</p>
      </div>
    </div>
  )
}

/* ============================ WORKSPACE ============================ */
function Workspace({ session, toast }) {
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [room, setRoom] = useState(null)
  const [forms, setForms] = useState([])
  const [formsLoading, setFormsLoading] = useState(false)
  const [active, setActive] = useState(null) // { id?, title, instructions, fields, sample }
  const [view, setView] = useState('rooms') // rooms | room | builder | sheet | preview
  const [rows, setRows] = useState([])
  const [link, setLink] = useState('')
  const [live, setLive] = useState(false)

  const refreshRooms = useCallback(async () => {
    try { setRooms(await api.listRooms()) }
    catch (e) { toast(e.message, 'error') }
    finally { setRoomsLoading(false) }
  }, [toast])

  useEffect(() => { refreshRooms() }, [refreshRooms])

  // active form ke live responses (teacher)
  useEffect(() => {
    if (!active?.id) return
    try { return api.subscribe(active.id, setRows) }
    catch (e) { toast(e.message, 'error') }
  }, [active?.id, toast])

  const openRoom = async (r) => {
    setRoom(r); setActive(null); setView('room'); setFormsLoading(true)
    try { setForms(await api.listForms(r.id)) }
    catch (e) { toast(e.message, 'error') }
    finally { setFormsLoading(false) }
  }

  const refreshForms = async () => {
    if (!room) return
    try { setForms(await api.listForms(room.id)) }
    catch (e) { toast(e.message, 'error') }
  }

  const createRoom = async ({ name, subject }) => {
    try {
      const r = await api.createRoom({ name, subject })
      setRooms((rs) => [r, ...rs])
      setCreatingRoom(false)
      toast('Class room created 🎉')
      openRoom(r)
    } catch (e) { toast(e.message, 'error') }
  }

  const deleteRoom = async (r) => {
    if (!confirm(`Delete "${r.name}" and all of its forms and responses?`)) return
    try {
      await api.deleteRoom(r.id)
      setRooms((rs) => rs.filter((x) => x.id !== r.id))
      if (room?.id === r.id) { setRoom(null); setView('rooms'); setActive(null); setForms([]) }
      toast('Class room deleted')
    } catch (e) { toast(e.message, 'error') }
  }

  const newForm = () => {
    setActive({
      title: '', instructions: '',
      fields: [{ id: 'f1', name: 'Full Name', type: 'text' }],
      sample: {},
    })
    setLink(''); setLive(false); setRows([]); setView('builder')
  }

  const openForm = async (meta) => {
    try {
      const f = await api.getForm(meta.id)
      if (!f) return toast('Form not found', 'error')
      setActive({ ...f, room_id: room.id })
      setLink(api.buildLink(f.id)); setLive(true); setRows([]); setView('builder')
    } catch (e) { toast(e.message, 'error') }
  }

  const publish = async () => {
    if (!active?.title.trim()) return toast('Enter a form title', 'error')
    if (!active.fields.length) return toast('Add at least one field', 'error')
    try {
      const res = await api.publishForm({ ...active, room_id: room.id })
      setActive((a) => ({ ...a, id: res.id, room_id: room.id }))
      setLink(res.link); setLive(true)
      refreshForms()
      toast('Form is live 🎉')
    } catch (e) { toast(e.message, 'error') }
  }

  const deleteForm = async (id) => {
    if (!confirm('Delete this form and all of its responses?')) return
    try {
      await api.deleteForm(id)
      if (active?.id === id) { setActive(null); setLink(''); setLive(false); setRows([]); setView('room') }
      refreshForms()
      toast('Form deleted')
    } catch (e) { toast(e.message, 'error') }
  }

  const deleteRow = async (id) => {
    try { await api.deleteSubmission(id); setRows((r) => r.filter((x) => x.id !== id)); toast('Response deleted') }
    catch (e) { toast(e.message, 'error') }
  }

  const copyLink = (id) => {
    const url = api.buildLink(id)
    navigator.clipboard?.writeText(url)
    toast('Link copied to clipboard')
  }

  const backToRoom = () => { setView('room'); setActive(null); setLink(''); setLive(false); setRows([]) }

  const breadcrumb = view === 'rooms' || !room ? 'My Class Rooms' : room.name

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Sidebar */}
      <aside className="border-b border-slate-800 bg-slate-900 text-slate-300 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0">
        <div className="flex items-center gap-2 px-5 py-4 lg:py-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500 text-white"><Sparkles size={18} /></div>
          <span className="text-lg font-bold text-white">FormFlow</span>
          {room && <span className="ml-auto rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-300">Room</span>}
        </div>

        <div className="px-3 pb-3">
          <button onClick={() => { setView('rooms'); setRoom(null); setActive(null); setCreatingRoom(true) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500">
            <Plus size={16} />New Class Room
          </button>
        </div>

        <div className="px-3 pb-4">
          <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-slate-500">My Class Rooms</p>
          {roomsLoading ? (
            <p className="px-2 py-3 text-sm text-slate-500"><Loader2 size={14} className="inline animate-spin" /> Loading…</p>
          ) : rooms.length ? (
            <nav className="space-y-1">
              {rooms.map((r) => (
                <button key={r.id} onClick={() => openRoom(r)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${room?.id === r.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-white'}`}>
                  <FolderOpen size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    {r.subject && <span className="block truncate text-xs text-slate-400">{r.subject}</span>}
                  </span>
                </button>
              ))}
            </nav>
          ) : (
            <p className="px-2 py-3 text-sm text-slate-500">No class rooms yet — start with “New Class Room”.</p>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-8">
          <p className="truncate text-sm font-semibold text-slate-600">{breadcrumb}</p>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{session.user.email}</p>
              <p className="text-xs text-slate-400">Teacher</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {(session.user.email || 'T')[0].toUpperCase()}
            </div>
            <button onClick={() => auth.signOut()} className={btnGhost + ' px-3 py-2'} aria-label="Logout">
              <LogOut size={16} /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="p-4 pb-24 sm:p-8 lg:pb-8">
          {active && (
            <div className="mx-auto mb-4 flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {[
                { id: 'builder', label: 'Builder', icon: LayoutDashboard },
                { id: 'sheet', label: 'Live Sheet', icon: Table2 },
                { id: 'preview', label: 'Preview', icon: GraduationCap },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${view === id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          )}

          {view === 'rooms' && (
            <RoomsView {...{ rooms, roomsLoading, creatingRoom, setCreatingRoom, createRoom, openRoom, deleteRoom }} />
          )}

          {view === 'room' && room && (
            <RoomView {...{ room, forms, formsLoading, onBack: () => { setRoom(null); setView('rooms') }, onNewForm: newForm, onOpenForm: openForm, onDeleteForm: deleteForm, onDeleteRoom: deleteRoom, copyLink }} />
          )}

          {view === 'builder' && active && (
            <div className="mx-auto max-w-4xl space-y-4">
              <button onClick={backToRoom} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"><ArrowLeft size={16} />{room.name}</button>
              <Builder {...{ form: active, setForm: setActive, publish, live, link, toast }} />
            </div>
          )}

          {view === 'sheet' && active && (
            <div className="mx-auto max-w-6xl space-y-4">
              <button onClick={backToRoom} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"><ArrowLeft size={16} />{room.name}</button>
              <Sheet {...{ form: active, rows, toast, deleteRow }} />
            </div>
          )}

          {view === 'preview' && active && (
            <div className="mx-auto max-w-xl space-y-4">
              <button onClick={backToRoom} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"><ArrowLeft size={16} />{room.name}</button>
              <Student form={active} toast={toast} formId={active.id} solo={false} />
            </div>
          )}
        </main>
      </div>

      {room && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur lg:hidden">
          {[
            { id: 'room', label: 'Forms', icon: FolderOpen },
            { id: 'builder', label: 'Builder', icon: LayoutDashboard },
            { id: 'sheet', label: 'Live', icon: Table2 },
            { id: 'preview', label: 'Preview', icon: GraduationCap },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { if (id !== 'room' && !active) return; setView(id) }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${view === id ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================ ROOMS ============================ */
function RoomsView({ rooms, roomsLoading, creatingRoom, setCreatingRoom, createRoom, openRoom, deleteRoom }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    createRoom({ name, subject })
    setName(''); setSubject('')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Class Rooms</h1>
        <p className="text-sm text-slate-500">Each room has its own forms — responses are visible only to you.</p>
      </header>

      {creatingRoom && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Class Room</h2>
            <button type="button" onClick={() => setCreatingRoom(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">Room name
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className={inputCls + ' mt-1 font-normal'} placeholder="e.g. Math 101" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Subject (optional)
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls + ' mt-1 font-normal'} placeholder="e.g. Algebra – Fall 2026" />
            </label>
          </div>
          <button className={btnPrimary}><Plus size={16} />Create room</button>
        </form>
      )}

      {roomsLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading class rooms…</p>
      ) : rooms.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <div key={r.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
              <button onClick={() => openRoom(r)} className="flex w-full items-start gap-3 text-left">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><FolderOpen size={18} /></div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{r.name}</p>
                  <p className="truncate text-xs text-slate-500">{r.subject || 'No subject'}</p>
                </div>
              </button>
              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => openRoom(r)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Open room →</button>
                <button onClick={() => deleteRoom(r)} aria-label="Delete room" className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-100 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !creatingRoom && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <FolderOpen className="mx-auto text-slate-300" size={40} />
            <p className="mt-3 font-semibold text-slate-700">No class rooms yet</p>
            <p className="text-sm text-slate-500">Create your first class room, then publish forms inside it.</p>
            <button onClick={() => setCreatingRoom(true)} className={btnPrimary + ' mt-4'}><Plus size={16} />New Class Room</button>
          </div>
        )
      )}
    </div>
  )
}

function RoomView({ room, forms, formsLoading, onBack, onNewForm, onOpenForm, onDeleteForm, onDeleteRoom, copyLink }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"><ArrowLeft size={16} />My Class Rooms</button>
          <h1 className="text-2xl font-bold text-slate-900">{room.name}</h1>
          <p className="text-sm text-slate-500">{room.subject || 'No subject'} · {forms.length} form{forms.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onDeleteRoom(room)} className={btnGhost + ' text-rose-600 hover:border-rose-300 hover:text-rose-700'}><Trash2 size={16} />Delete room</button>
          <button onClick={onNewForm} className={btnPrimary}><Plus size={16} />New Form</button>
        </div>
      </header>

      {formsLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading forms…</p>
      ) : forms.length ? (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {forms.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-indigo-50/40">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><FileText size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{f.title}</p>
                <p className="text-xs text-slate-400">{fmt(f.created_at)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onOpenForm(f)} className={btnGhost + ' px-3 py-2 text-xs'}><LayoutDashboard size={14} />Open</button>
                <button onClick={() => copyLink(f.id)} className={btnGhost + ' px-3 py-2 text-xs'}><Copy size={14} />Link</button>
                <button onClick={() => onDeleteForm(f.id)} aria-label="Delete form" className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-100 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <FileText className="mx-auto text-slate-300" size={40} />
          <p className="mt-3 font-semibold text-slate-700">No forms in this room</p>
          <p className="text-sm text-slate-500">Create your first form, then Go Live and share its link.</p>
          <button onClick={onNewForm} className={btnPrimary + ' mt-4'}><Plus size={16} />New Form</button>
        </div>
      )}
    </div>
  )
}

/* ============================ BUILDER ============================ */
function Builder({ form, setForm, publish, live, link, toast }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const addField = () => set({ fields: [...form.fields, { id: uid(), name: '', type: 'text' }] })
  const updField = (id, patch) => set({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const delField = (id) => set({ fields: form.fields.filter((f) => f.id !== id) })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Form Builder</h1>
          <p className="text-sm text-slate-500">Design the columns students will fill in.</p>
        </div>
        <button onClick={publish} className={btnPrimary + ' px-6 py-3 text-base'}><Rocket size={18} />{form.id ? 'Update & Re-publish' : 'Go Live / Generate Link'}</button>
      </header>

      {link && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="text-emerald-600" size={20} />
            <code className="min-w-0 flex-1 break-all text-sm text-emerald-800">{link}</code>
            <button className={btnGhost} onClick={() => { navigator.clipboard?.writeText(link); toast('Link copied to clipboard') }}><Copy size={16} />Copy</button>
          </div>
          {!isShareable && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-900">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              This link only opens on this computer (http/localhost). Deploy the app over HTTPS and set <code className="mx-1 font-mono">VITE_APP_URL</code> to share it on WhatsApp.
            </p>
          )}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="block text-sm font-semibold">Form Title
          <input className={inputCls + ' mt-1.5'} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Lab Attendance – Week 3" />
        </label>
        <label className="block text-sm font-semibold">Instructions
          <textarea rows={3} className={inputCls + ' mt-1.5'} value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder="What should students know?" />
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Columns / Fields</h2>
          <button onClick={addField} className={btnGhost}><Plus size={16} />Add Field</button>
        </div>
        <div className="space-y-3">
          {form.fields.map((f, i) => (
            <div key={f.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 transition hover:bg-indigo-50/50 sm:flex-row sm:items-center">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">{i + 1}</span>
              <input className={inputCls} placeholder="Column name (e.g. Full Name)" value={f.name} onChange={(e) => updField(f.id, { name: e.target.value })} />
              <select className={inputCls + ' sm:w-44'} value={f.type} onChange={(e) => updField(f.id, { type: e.target.value })}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => delField(f.id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600" aria-label="Remove field"><Trash2 size={18} /></button>
            </div>
          ))}
          {!form.fields.length && <p className="py-6 text-center text-sm text-slate-400">No fields yet. Click “Add Field”.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-1 font-semibold">Sample Entry</h2>
        <p className="mb-4 text-sm text-slate-500">Students see this as a reference at the top of the form.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {form.fields.map((f) => (
            <label key={f.id} className="text-xs font-semibold text-slate-500">{f.name || 'Untitled'}
              <input className={inputCls + ' mt-1 font-normal'} placeholder={(TYPES[f.type] || TYPES.text).sample}
                value={form.sample[f.id] ?? ''} onChange={(e) => set({ sample: { ...form.sample, [f.id]: e.target.value } })} />
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ============================ LIVE SPREADSHEET ============================ */
function Sheet({ form, rows, toast, deleteRow }) {
  const cols = form.fields
  const toMatrix = () => rows.map((r) => ({ Timestamp: fmt(r.createdAt), ...Object.fromEntries(cols.map((c) => [c.name || c.id, r.data[c.id] ?? ''])) }))

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(toMatrix())
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Submissions')
    XLSX.writeFile(wb, `${(form.title || 'form').replace(/\W+/g, '_')}.xlsx`)
    toast('Excel file exported successfully')
  }
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.text(form.title || 'Form', 14, 15)
    autoTable(doc, { startY: 22, head: [['Timestamp', ...cols.map((c) => c.name)]], body: rows.map((r) => [fmt(r.createdAt), ...cols.map((c) => r.data[c.id] ?? '')]), headStyles: { fillColor: [79, 70, 229] } })
    doc.save(`${(form.title || 'form').replace(/\W+/g, '_')}.pdf`)
    toast('PDF downloaded')
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">Live Spreadsheet <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><Radio size={12} className="animate-pulse" />Real-time</span></h1>
          <p className="text-sm text-slate-500">{rows.length} responses · {form.title || 'Untitled form'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportXlsx} className={btnPrimary + ' bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'}><Download size={16} />Export to Excel (.xlsx)</button>
          <button onClick={exportPdf} className={btnGhost}><FileText size={16} />Download PDF</button>
        </div>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-300">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Timestamp</th>{cols.map((c) => <th key={c.id} className="px-4 py-3">{c.name || 'Untitled'}</th>)}<th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.id} className="group transition hover:bg-indigo-50/60">
                <td className="px-4 py-3 text-slate-400">{rows.length - i}</td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-indigo-700">{fmt(r.createdAt)}</td>
                {cols.map((c) => <td key={c.id} className="px-4 py-3">{r.data[c.id] ?? '—'}</td>)}
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteRow(r.id)} aria-label="Delete response" className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-100 hover:text-rose-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length + 3} className="py-12 text-center text-slate-400">Waiting for submissions…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============================ STUDENT FORM ============================ */
function Student({ form, toast, formId, solo }) {
  const [vals, setVals] = useState({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!formId) return toast('Publish the form with “Go Live” first — submissions open once it is published.', 'error')
    setBusy(true)
    try { await api.submit(formId, vals); setDone(true); setVals({}); toast('Submitted successfully!') }
    catch (err) { toast(err.message || 'Something went wrong. Try again.', 'error') }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white sm:p-8">
          <h1 className="text-2xl font-bold">{form.title || 'Untitled form'}</h1>
          {!solo && <p className="mt-1 text-xs text-indigo-200">Student preview</p>}
        </div>
        {done ? (
          <div className="space-y-4 p-10 text-center">
            <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
            <h2 className="text-xl font-bold">Thank you!</h2>
            <p className="text-slate-500">Your response has been recorded.</p>
            <button className={btnGhost} onClick={() => setDone(false)}>Submit another response</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 p-6 sm:p-8">
            {form.instructions && <div className="flex gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900"><Info size={18} className="mt-0.5 shrink-0" /><p>{form.instructions}</p></div>}
            {form.fields.length > 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Sample entry</p>
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  {form.fields.map((f) => <div key={f.id} className="flex gap-2"><dt className="text-slate-500">{f.name}:</dt><dd className="font-medium">{form.sample?.[f.id] || '—'}</dd></div>)}
                </dl>
              </div>
            )}
            {form.fields.map((f) => (
              <label key={f.id} className="block text-sm font-semibold">{f.name} <span className="text-rose-500">*</span>
                <input required type={(TYPES[f.type] || TYPES.text).input} placeholder={(TYPES[f.type] || TYPES.text).ph} className={inputCls + ' mt-1.5 font-normal'}
                  value={vals[f.id] ?? ''} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })} />
              </label>
            ))}
            {!form.fields.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">This form has no fields yet.</p>}
            <button disabled={busy || !form.fields.length} className={btnPrimary + ' w-full py-4 text-base disabled:opacity-60'}><Send size={18} />{busy ? 'Submitting…' : 'Submit Information'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
