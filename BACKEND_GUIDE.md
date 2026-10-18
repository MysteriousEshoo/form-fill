# Backend Connection Guide (Supabase – step by step)

Sirf **`src/api.js`** ko badalna hai. UI ka koi code touch nahi karna.
Is file mein 4 functions hain: `publishForm`, `getForm`, `subscribe`, `submit`.

## Step 1 – Supabase project banao
1. https://supabase.com par free account → **New project**.
2. Settings → API se copy karo: **Project URL** aur **anon public key**.

## Step 2 – Tables banao (SQL Editor mein run karo)
```sql
create table forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instructions text,
  fields jsonb not null,      -- [{id,name,type}]
  sample jsonb,
  owner uuid references auth.users(id),
  created_at timestamptz default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade,
  data jsonb not null,        -- {fieldId: value}
  created_at timestamptz default now()   -- <- server-side Timestamp
);

alter publication supabase_realtime add table submissions;  -- real-time ON
```

## Step 3 – Security (RLS) policies
```sql
alter table forms enable row level security;
alter table submissions enable row level security;

-- Anyone with the link can read a form and submit
create policy "read forms"    on forms for select using (true);
create policy "insert answers" on submissions for insert with check (true);

-- Only the teacher (owner) can create forms and read responses
create policy "teacher creates" on forms for insert with check (auth.uid() = owner);
create policy "teacher reads"   on submissions for select
  using (exists (select 1 from forms f where f.id = form_id and f.owner = auth.uid()));
```

## Step 4 – Install & env
```bash
npm install @supabase/supabase-js
```
Project root mein `.env` file banao:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 5 – `src/api.js` ko replace karo
```js
import { createClient } from '@supabase/supabase-js'
const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const api = {
  async publishForm(f) {
    const { data: { user } } = await sb.auth.getUser()
    const { data, error } = await sb.from('forms')
      .insert({ title: f.title, instructions: f.instructions, fields: f.fields, sample: f.sample, owner: user?.id })
      .select().single()
    if (error) throw error
    return { id: data.id, link: `${location.origin}${location.pathname}?form=${data.id}` }
  },

  async getForm(id) {
    const { data, error } = await sb.from('forms').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  subscribe(formId, cb) {
    const toRow = (r) => ({ id: r.id, createdAt: r.created_at, data: r.data })
    // initial load
    sb.from('submissions').select('*').eq('form_id', formId).order('created_at', { ascending: false })
      .then(({ data }) => cb((data || []).map(toRow)))
    // real-time inserts
    let current = []
    const ch = sb.channel('subs-' + formId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions', filter: `form_id=eq.${formId}` },
        (p) => { current = [toRow(p.new), ...current]; cb(current) })
      .subscribe()
    return () => sb.removeChannel(ch)
  },

  async submit(formId, data) {
    const { error } = await sb.from('submissions').insert({ form_id: formId, data })
    if (error) throw error
  },
}
```
> Note: `current` ko initial load ke baad bhi set karna hai: `.then(({data}) => { current = data.map(toRow); cb(current) })`.

## Step 6 – App.jsx mein 3 chhote changes
1. **Mock simulator hatao**: `// MOCK: a new student "submits" every 9s...` wala poora `useEffect` delete karo.
2. **Student link**: `Student` component ko form load karna hai. `App` mein add karo:
   ```js
   useEffect(() => { if (formIdFromUrl) api.getForm(formIdFromUrl).then(f => setForm({ ...f })) }, [])
   ```
3. **Teacher live sheet**: `api.subscribe(...)` ko `formId` do jo `goLive` se mila (state mein save karo: `setFormId(res.id)`).

## Step 7 – Teacher login (recommended)
Supabase → Authentication → Providers → Email/Google enable.
Login page banao: `sb.auth.signInWithPassword({email, password})`. Sirf logged-in teacher hi Builder/Sheet dekhe;
student link (`?form=ID`) bina login ke chalta hai.

## Step 8 – Deploy
`npm run build` → **Vercel / Netlify** par push karo. Env variables wahan bhi add karo.

---
## Firebase use karna ho to (same 4 functions)
- `publishForm` → `addDoc(collection(db,'forms'), f)`
- `getForm` → `getDoc(doc(db,'forms',id))`
- `subscribe` → `onSnapshot(query(collection(db,'forms',id,'submissions'), orderBy('createdAt','desc')), snap => cb(...))`
- `submit` → `addDoc(collection(db,'forms',id,'submissions'), { data, createdAt: serverTimestamp() })`

## Tips
- Timestamp hamesha **server side** rakho (`now()` / `serverTimestamp()`), client ki ghadi par bharosa mat karo.
- Spam rokne ke liye later Supabase Edge Function ya Cloudflare Turnstile add karo.
- Dynamic columns jsonb mein hain, isliye teacher kabhi bhi columns badle to schema change nahi karna padta.
