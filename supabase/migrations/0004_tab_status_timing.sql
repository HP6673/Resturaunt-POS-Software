-- Tracks when a tab's status last changed, so the UI can show "time in this
-- stage" alongside "total time open". Run once in the Supabase SQL editor.
-- Safe to re-run.

alter table tabs add column if not exists status_changed_at timestamptz not null default now();

update tabs set status_changed_at = opened_at where status_changed_at is null;
