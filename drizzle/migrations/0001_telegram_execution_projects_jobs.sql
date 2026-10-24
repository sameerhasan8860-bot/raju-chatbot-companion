CREATE TABLE public.tg_projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, title text NOT NULL, runtime text NOT NULL CHECK (runtime IN ('python','node')), files jsonb NOT NULL, test_command text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.tg_projects TO service_role;
ALTER TABLE public.tg_projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX tg_projects_owner ON public.tg_projects(telegram_id, created_at DESC);
CREATE TABLE public.tg_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL, project_id uuid NOT NULL REFERENCES public.tg_projects(id), repository text NOT NULL, branch text NOT NULL, commit_sha text, run_id bigint, status text NOT NULL DEFAULT 'preparing', conclusion text, html_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.tg_jobs TO service_role;
ALTER TABLE public.tg_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX tg_jobs_owner ON public.tg_jobs(telegram_id, created_at DESC);