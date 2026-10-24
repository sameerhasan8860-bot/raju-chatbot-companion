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
- GitHub execution lives in src/server/execution and is dispatched only by explicit Telegram commands; preserve the ordinary chat prompt/model/memory path to prevent accidental execution.
- All verified private-chat senders may test only their own projects/jobs against the owner-configured private dedicated repository; reject unrelated files/workflows to prevent broad connector access from affecting other code.
- Generated code is data in execution.json on a unique branch; only the fixed bounded workflow runs it in a nonprivileged, offline container without app or repository credentials, avoiding arbitrary execution on the Lovable backend.
