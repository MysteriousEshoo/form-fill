-- ============================================================
--  FormFlow – Supabase setup (poora script SQL Editor mein run karein)
--  Teacher = login (owner). Student = bina login, sirf apna form submit.
-- ============================================================

-- ---------- Tables ----------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  created_at timestamptz default now()
);

create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  title text not null,
  instructions text,
  fields jsonb not null,      -- [{id,name,type}]
  sample jsonb,
  owner uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade,
  data jsonb not null,        -- {fieldId: value}
  created_at timestamptz default now()
);

-- Purani / test forms jinka koi owner nahi (pehle wale demo run se)
delete from forms where owner is null;

alter table forms add column if not exists room_id uuid references rooms(id) on delete cascade;
create index if not exists rooms_teacher_id_idx on rooms (teacher_id);
create index if not exists forms_room_id_idx on forms (room_id);
create index if not exists submissions_form_id_created_at_idx on submissions (form_id, created_at desc);

-- ---------- Server-side validation (client par bharosa nahi) ----------
create or replace function validate_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  form_row forms%rowtype;
  fld jsonb;
  key text;
  val text;
begin
  select * into form_row from forms where id = new.form_id;
  if not found then
    raise exception 'Yeh form mojood nahi ya delete ho chuka hai';
  end if;

  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'Submission data object hona chahiye';
  end if;

  for fld in select * from jsonb_array_elements(form_row.fields) loop
    key := fld->>'id';
    val := new.data->>key;
    if not (new.data ? key) or val is null or btrim(val) = '' then
      raise exception 'Field "%" zaroori hai', coalesce(fld->>'name', key);
    end if;
    if length(val) > 1000 then
      raise exception 'Field "%" bohat lamba hai (max 1000 characters)', coalesce(fld->>'name', key);
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists submissions_validate on submissions;
create trigger submissions_validate
  before insert on submissions
  for each row execute function validate_submission();

-- ---------- Security (RLS) ----------
alter table rooms enable row level security;
alter table forms enable row level security;
alter table submissions enable row level security;

-- purani policies hatao
drop policy if exists "read forms" on forms;
drop policy if exists "publish forms" on forms;
drop policy if exists "update forms" on forms;
drop policy if exists "insert answers" on submissions;
drop policy if exists "read answers" on submissions;
drop policy if exists "public read forms" on forms;
drop policy if exists "owner insert forms" on forms;
drop policy if exists "owner update forms" on forms;
drop policy if exists "owner delete forms" on forms;
drop policy if exists "public insert answers" on submissions;
drop policy if exists "owner read answers" on submissions;
drop policy if exists "owner delete answers" on submissions;
drop policy if exists "students read forms" on forms;
drop policy if exists "owner read forms" on forms;
drop policy if exists "room owner insert forms" on forms;
drop policy if exists "room owner read forms" on forms;
drop policy if exists "room owner update forms" on forms;
drop policy if exists "room owner delete forms" on forms;
drop policy if exists "teacher rooms" on rooms;
drop policy if exists "teacher create rooms" on rooms;
drop policy if exists "teacher update rooms" on rooms;
drop policy if exists "teacher delete rooms" on rooms;

-- ROOMS: sirf apne rooms dikhte hain, sirf apna room bana/badal/delete
create policy "teacher rooms" on rooms
  for select using (auth.uid() = teacher_id);
create policy "teacher create rooms" on rooms
  for insert with check (auth.uid() = teacher_id);
create policy "teacher update rooms" on rooms
  for update using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy "teacher delete rooms" on rooms
  for delete using (auth.uid() = teacher_id);

-- FORMS:
-- Student (anonymous, auth.uid() null) link se padh sakta hai.
-- Login kiya hua teacher sirf apni forms padh sakta hai (doosre ki nahi).
create policy "students read forms" on forms
  for select using (owner = auth.uid() or auth.uid() is null);
create policy "owner read forms" on forms
  for select using (owner = auth.uid());

-- Teacher apni form bana/badal/delete kare, aur room bhi uska ho
create policy "room owner insert forms" on forms
  for insert with check (
    auth.uid() = owner
    and (room_id is null or exists (
      select 1 from rooms r where r.id = forms.room_id and r.teacher_id = auth.uid()
    ))
  );
create policy "room owner update forms" on forms
  for update using (auth.uid() = owner)
  with check (
    auth.uid() = owner
    and (room_id is null or exists (
      select 1 from rooms r where r.id = forms.room_id and r.teacher_id = auth.uid()
    ))
  );
create policy "room owner delete forms" on forms
  for delete using (auth.uid() = owner);

-- SUBMISSIONS: student insert kar sakta hai, padh/delete sirf form owner
create policy "public insert answers" on submissions
  for insert with check (true);
create policy "owner read answers" on submissions
  for select using (
    exists (select 1 from forms f where f.id = submissions.form_id and f.owner = auth.uid())
  );
create policy "owner delete answers" on submissions
  for delete using (
    exists (select 1 from forms f where f.id = submissions.form_id and f.owner = auth.uid())
  );

-- ---------- Real-time (students ko live form edits, teacher ko live responses) ----------
do $$
begin
  begin
    alter publication supabase_realtime add table forms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table submissions;
  exception when duplicate_object then null;
  end;
end $$;
