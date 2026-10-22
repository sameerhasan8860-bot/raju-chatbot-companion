<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Telegram bot runs via webhook at src/routes/api/public/telegram/webhook.ts (secret header check + update_id dedupe); logic lives in src/server/telegram/*, AI providers in src/server/ai/providers.ts so handlers stay provider-agnostic.
- Bot tables (tg_*) are service-role only with no RLS policies; every query must filter by the sender's telegram_id to enforce ownership.
