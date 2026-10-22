CREATE TABLE public.tg_users (
  telegram_id bigint PRIMARY KEY,
  username text,
  first_name text,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  context_reset_at timestamptz NOT NULL DEFAULT 'epoch',
  window_start timestamptz NOT NULL DEFAULT now(),
  window_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tg_updates (update_id bigint PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.tg_messages (
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tg_messages (telegram_id, created_at DESC);
CREATE TABLE public.tg_memories (
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL,
  category text NOT NULL DEFAULT 'fact',
  content text NOT NULL,
  project text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(project,'') || ' ' || content)) STORED
);
CREATE INDEX ON public.tg_memories (telegram_id);
CREATE INDEX ON public.tg_memories USING gin (search);
GRANT ALL ON public.tg_users, public.tg_updates, public.tg_messages, public.tg_memories TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tg_messages_id_seq, public.tg_memories_id_seq TO service_role;
ALTER TABLE public.tg_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tg_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tg_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tg_memories ENABLE ROW LEVEL SECURITY;