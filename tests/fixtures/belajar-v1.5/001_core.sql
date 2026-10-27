-- Fresh project only. One subject per database. No operational rows are seeded.
begin;
create schema if not exists reev_private;
revoke all on schema reev_private from public;
create table public.profiles(id uuid primary key references auth.users(id), name text not null check(length(name) between 1 and 150), role text not null check(role in ('teacher','student')), active boolean not null default true);
create table public.school_settings(id boolean primary key default true check(id), subject text not null default 'Informatika', school text not null default 'MTsN 3 Sidenreng Rappang', teacher text not null default '', kktp numeric not null default 73 check(kktp between 0 and 100), classical_target numeric not null default 80 check(classical_target between 0 and 100), initial_hearts integer check(initial_hearts between 1 and 100), min_hearts integer not null default 0 check(min_hearts between 0 and 100), restore_hearts boolean not null default false, max_stars integer not null default 20 check(max_stars between 1 and 1000), bonus_enabled boolean not null default false, stars_per_percent integer not null default 10 check(stars_per_percent>0), accent text not null default '#176b58' check(accent ~ '^#[0-9a-fA-F]{6}$'), timezone text not null default 'Asia/Makassar', check(initial_hearts is null or min_hearts<=initial_hearts));
insert into public.school_settings default values;
create table public.semesters(id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default false, archived boolean not null default false, check(not(active and archived)));
create unique index single_active_semester on public.semesters(active) where active;
create table public.classes(id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 80), kktp numeric check(kktp between 0 and 100), active boolean not null default true);
create table public.students(id uuid primary key default gen_random_uuid(), nisn text not null unique check(nisn ~ '^[0-9]{5,20}$'), name text not null check(length(name) between 1 and 150), user_id uuid unique references public.profiles(id), registered_phone text unique check(registered_phone ~ '^\+[1-9][0-9]{7,14}$'), phone_verified boolean not null default false, active boolean not null default true, check(not phone_verified or registered_phone is not null));
create table public.class_memberships(student_id uuid references public.students(id), semester_id uuid references public.semesters(id), class_id uuid not null references public.classes(id), primary key(student_id,semester_id));
create index membership_class on public.class_memberships(class_id,semester_id);
create table public.tasks(id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Za-z0-9_-]{1,40}$'), title text not null check(length(title) between 1 and 200), kind text not null check(kind in ('FORMATIF','SUMATIF')), class_id uuid not null references public.classes(id), semester_id uuid not null references public.semesters(id), material text not null default '', due_date date, assessment_date date, max_score numeric not null default 100 check(max_score>0), kktp numeric not null check(kktp between 0 and 100), classical_target numeric not null default 80 check(classical_target between 0 and 100), rubric jsonb not null default '[]', created_at timestamptz not null default now());
create index tasks_period on public.tasks(semester_id,class_id);
create table public.task_targets(task_id uuid references public.tasks(id),student_id uuid references public.students(id),status text not null default 'Belum' check(status in ('Belum','Selesai','Dinilai')),primary key(task_id,student_id));
create table public.grades(task_id uuid,student_id uuid,score numeric check(score between 0 and 100),components jsonb not null default '[]',feedback text not null default '',updated_at timestamptz not null default now(),primary key(task_id,student_id),foreign key(task_id,student_id) references public.task_targets(task_id,student_id));
create table public.attendance_meetings(id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes(id),semester_id uuid not null references public.semesters(id),date date not null,number integer not null check(number>0),material text not null default '',unique(class_id,semester_id,number));
create table public.attendance_records(meeting_id uuid references public.attendance_meetings(id),student_id uuid references public.students(id),status text not null check(status in ('Hadir','Sakit','Izin','Alpa')),note text not null default '',primary key(meeting_id,student_id));
create table public.star_transactions(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),semester_id uuid not null references public.semesters(id),amount integer not null check(amount<>0),reason text not null check(length(reason) between 1 and 500),reversal_of uuid unique references public.star_transactions(id),created_at timestamptz not null default now());
create table public.violations(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),semester_id uuid not null references public.semesters(id),code text not null,description text not null,remedy text not null default '',due_date date,status text not null default 'Perlu ditebus' check(status in ('Perlu ditebus','Dalam proses','Selesai','Dibatalkan')),completion_note text not null default '',created_at timestamptz not null default now());
create table public.heart_transactions(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),semester_id uuid not null references public.semesters(id),amount integer not null check(amount<>0),reason text not null,violation_id uuid references public.violations(id),kind text not null check(kind in ('initial','deduction','restore','cancel')),created_at timestamptz not null default now(),unique(violation_id,kind));
create unique index one_initial_heart on public.heart_transactions(student_id,semester_id) where kind='initial';
create table public.whatsapp_links(student_id uuid primary key references public.students(id),phone text not null unique,created_at timestamptz not null default now());
create table public.teacher_whatsapp_allowlist(phone text primary key check(phone ~ '^\+[1-9][0-9]{7,14}$'),profile_id uuid not null references public.profiles(id),active boolean not null default true);
create table public.audit_logs(id bigint generated always as identity primary key,actor uuid references public.profiles(id),source text not null,action text not null,entity text not null,old_data jsonb,new_data jsonb,created_at timestamptz not null default now());
create table public.grade_history(id bigint generated always as identity primary key,task_id uuid not null,student_id uuid not null,old_data jsonb,new_data jsonb,actor uuid,source text,created_at timestamptz not null default now());
create table public.whatsapp_command_logs(event_key text primary key,phone text not null,command text not null,status text not null default 'processing',reason text,created_at timestamptz not null default now());
create index wa_rate on public.whatsapp_command_logs(phone,created_at);
create table public.pending_confirmations(token uuid primary key default gen_random_uuid(),phone text not null,actor uuid not null references public.profiles(id),payload jsonb not null,expires_at timestamptz not null default now()+interval '5 minutes',used_at timestamptz);
create table public.wa_outbox(event_key text primary key references public.whatsapp_command_logs(event_key),phone text not null,body text not null,status text not null default 'queued' check(status in ('queued','sending','sent','delivered','read','failed','unknown')),gateway_id text,updated_at timestamptz not null default now());
create table reev_private.requests(id uuid primary key,actor uuid not null,payload jsonb not null,result jsonb not null);

create function reev_private.teacher() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and active and role='teacher')$$;
create function reev_private.own_student(s uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.students s join public.profiles p on p.id=s.user_id where s.id=$1 and p.id=auth.uid() and p.active and s.active)$$;
create function reev_private.member(c uuid,sem uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.class_memberships m where m.class_id=c and m.semester_id=sem and reev_private.own_student(m.student_id))$$;
grant usage on schema reev_private to authenticated;
grant execute on function reev_private.teacher(),reev_private.own_student(uuid),reev_private.member(uuid,uuid) to authenticated;
-- Read-only client grants. All writes pass through validated transactional RPCs.
do $$declare t text;begin
foreach t in array array['profiles','school_settings','semesters','classes','students','class_memberships','tasks','task_targets','grades','attendance_meetings','attendance_records','star_transactions','violations','heart_transactions','whatsapp_links','teacher_whatsapp_allowlist','audit_logs','grade_history','whatsapp_command_logs','pending_confirmations','wa_outbox'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon,authenticated',t);
execute format('grant select on public.%I to authenticated',t);
execute format('create policy teacher_read on public.%I for select to authenticated using (reev_private.teacher())',t);
end loop;end$$;
create policy self on public.profiles for select to authenticated using(id=auth.uid() and active);
create policy own on public.students for select to authenticated using(reev_private.own_student(id));
create policy shared on public.school_settings for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and active));
create policy shared on public.semesters for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and active));
create policy own on public.classes for select to authenticated using(exists(select 1 from public.class_memberships m where m.class_id=classes.id and reev_private.own_student(m.student_id)));
create policy own on public.tasks for select to authenticated using(exists(select 1 from public.task_targets t where t.task_id=tasks.id and reev_private.own_student(t.student_id)));
create policy own on public.attendance_meetings for select to authenticated using(reev_private.member(class_id,semester_id));
do $$declare t text;begin
foreach t in array array['class_memberships','task_targets','grades','attendance_records','star_transactions','violations','heart_transactions','whatsapp_links','grade_history'] loop
execute format('create policy own on public.%I for select to authenticated using (reev_private.own_student(student_id))',t);
end loop;end$$;
-- Audit triggers cannot be disabled by clients; transaction rollback includes audit.
create function reev_private.audit() returns trigger language plpgsql security definer set search_path='' as $$
declare o jsonb;n jsonb;a uuid;src text;
begin
 o:=case when TG_OP='INSERT' then null else to_jsonb(old) end;n:=case when TG_OP='DELETE' then null else to_jsonb(new) end;
 a:=nullif(current_setting('reev.actor',true),'')::uuid;src:=coalesce(nullif(current_setting('reev.source',true),''),'bootstrap');
 insert into public.audit_logs(actor,source,action,entity,old_data,new_data) values(a,src,TG_OP,TG_TABLE_NAME,o,n);
 if TG_TABLE_NAME='grades' then insert into public.grade_history(task_id,student_id,old_data,new_data,actor,source) values(new.task_id,new.student_id,o,n,a,src);end if;
 return new;
end$$;
do $$declare t text;begin
foreach t in array array['profiles','school_settings','semesters','classes','students','class_memberships','tasks','task_targets','grades','attendance_meetings','attendance_records','star_transactions','violations','heart_transactions','whatsapp_links','teacher_whatsapp_allowlist'] loop
execute format('create trigger audited after insert or update or delete on public.%I for each row execute function reev_private.audit()',t);
end loop;end$$;
commit;
