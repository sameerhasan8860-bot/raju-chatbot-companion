# Telegram temporary project testing

## Added capability

The assistant's normal SYSTEM prompt, models, memories, history, existing commands and UI are unchanged. Code answers now get a separate optional testing offer. A narrow request such as “test this project”, “Yes, run it on your server”, or “test karo” prepares the sender's last code answer for review. It never dispatches a run. Python and Node projects can be generated, reviewed and tested without executing any project code on the application backend.

## Owner setup

1. Connect the GitHub **API connector**, not just Lovable Git sync. This project uses the linked GitHub connector through the gateway. Repository contents write, Actions write/workflow, and repository webhook administration permissions are required.
2. Create a **private, dedicated test repository**. It must be empty or contain only README.md. Do not use your Lovable application repository. Set `GITHUB_EXECUTION_REPOSITORY` to `owner/repository` through the secure configuration form.
3. Enable GitHub Actions in that repository. The first user-confirmed test creates `.github/workflows/telegram-sandbox.yml` on the default branch and installs a signed `workflow_run` webhook. The service refuses unexpected existing files or workflows rather than overwriting them. Webhook setup must succeed before dispatch; no silent polling fallback.
4. Do not add organization/repository secrets for untrusted tests. No Lovable, Telegram or GitHub credentials are passed into generated projects. Tests requiring real credentials or external effects are not supported by this sandbox; configure a separate reviewed deployment integration instead. Never paste credentials in Telegram.

## Telegram flow

- `/execution`: command list and limits.
- `/prepare <requirements>`: generates complete files, README setup/run instructions and test command, without executing, then creates a pending review. Important missing requirements are returned as a question. Environment variable names are detected from Python and Node source; this is static best-effort detection, not a guarantee of every configuration requirement.
- `/execute <project UUID>`: displays repository, file list, test command, possible GitHub usage costs and effects; stores a pending approval.
- `/confirm <job UUID>`: approves only this job; valid for 30 minutes, consumed atomically. Commits a project manifest on a unique branch and dispatches the fixed workflow.
- `/status`: lists your jobs; `/status <job UUID>` retrieves actual GitHub status and conclusion.
- `/logs <job UUID>`: fetches recent bounded, credential-redacted GitHub output.
- `/cancel <job UUID>`: cancels a pending approval or requests cancellation of an active GitHub run. Cancellation completion is verified by a later status check.
- `/rerun <job UUID>`: creates a fresh approval after the earlier job ends. Never reruns automatically.
- `/fix <job UUID>`: requires a verified failed run, retrieves real bounded logs and generates a proposed repaired project. Shows its full files and creates a fresh approval. Does not overwrite the previous project or run automatically.
- `/hosting`: explains permanent hosting options; the assistant can give server setup instructions without claiming server access.

All verified private-chat Telegram senders may use the tool, but database access is scoped to their sender ID. Users cannot select arbitrary repositories or read/control another user's jobs through the bot. The owner pays any GitHub usage costs; branches are retained for audit and require manual owner cleanup. Users who independently have repository access can see its contents: use this shared repository only with trusted repository collaborators.

## Isolation and limits

The workflow uses read-only repository permissions, checkout without persisted credentials, and no pull-request/push triggers. Files are materialized as data inside a fresh sandbox. Dependency installation happens in a Docker image build on the temporary runner. The test executes as a non-root user in a read-only container, no network, no capabilities, no credentials, 512 MB memory, one CPU, 128 process limit and bounded temporary storage. Dependencies can use network during image build, but no credentials or app environment are supplied to the build. This is not a hardened multi-tenant VM service; GitHub-hosted runners and containers have their own security limitations.

Installation is bounded to eight minutes, tests to five minutes, and the entire job to fifteen minutes. Up to 30 files / 150,000 source characters per project. Python 3.12 and Node 22 are supported. Node package installation disables lifecycle scripts. Projects needing other languages, browser services, online dependencies at runtime, writable source trees, or secrets may fail; do not claim those tests succeeded.

Success means the configured test command exited successfully. It is not independent proof of server startup, health checks or useful test coverage. There is no permanent hosting, public app URL, automatic deployment or infinite runner handover. Once a workflow ends, its application is not running.

## Status delivery and remaining validation

Progress notifications are emitted only for observed actions (files committed, dispatch accepted) and verified GitHub `workflow_run` events. The callback verifies HMAC on the raw body, matches the configured repository, owner-bearing branch, project job, commit, workflow path and dispatch event, then reads the actual run through GitHub. It stores run ID/status/conclusion and sends the result to the owning private Telegram chat. Repeated observed states are suppressed; delivery is best-effort and a crash between sending and recording delivery can cause a duplicate. GitHub does not emit every dependency/test step as a workflow-run event; a currently active step is reported only when returned by a jobs read. `/status` and `/logs` remain available for verification and delivery recovery.

Callback code is ready at `/api/public/github/execution`. The first confirmed job registers the stable preview callback by default. After publishing, set `GITHUB_EXECUTION_CALLBACK_URL` to this app's published `/api/public/github/execution` URL; no publication was performed in this task. The signing value is derived server-side from the linked connection key and is passed only to GitHub's webhook configuration, never to generated project code. Rotating the connection requires the hook to be refreshed by a new confirmed job.

Real credential insertion into source, shared repository secrets and secret-dependent sandbox tests were deliberately not implemented. Explicit consent does not prevent leaks from untrusted source, dependency installation, repository history or logs. Generated projects use environment-variable names and mocked services; live credential-dependent operation requires a separate reviewed, isolated hosting integration. Other languages, continuous runner handover, real-group messaging, deployment and guaranteed health checks remain unsupported.

Automated tests verify explicit opt-in, all-user access with sender ownership, cross-user rejection, cancelled/expired approvals, repository boundary checks, sensitive-source rejection, output redaction and honest completion reporting. A real Telegram → GitHub workflow test must be run by an authorized user after the repository passes setup checks. Credentials-dependent tests, deployment and reliable 24/7 hosting remain separate capabilities, not promises of this implementation.

## Files

Changed: `src/server/telegram/bot.ts` (one isolated command hook), `AGENTS.md` (architecture), `src/routes/__root.tsx` (remove generic project metadata).

Added: `src/server/execution/{validation,workflow,github,telegram}.ts`, execution tests, additive migration for `tg_projects` / `tg_jobs`, this guide, roadmap. Existing bot tables and data were not replaced.

## Automation update: exact changes and validation

Changed in this update:
- `src/server/telegram/bot.ts`: optional test offer after code replies; SYSTEM prompt and memory path preserved.
- `src/server/execution/telegram.ts`: natural-language conversion, automatic pending review, required configuration names, `/fix`, owner-bearing branches, approved webhook setup.
- `src/server/execution/github.ts`: verified progress hook creation/update through the linked GitHub API.
- `src/server/execution/validation.ts`: `/fix` recognition and strengthened credential rejection/redaction.
- `src/server/execution/telegram.test.ts`: review-only natural request regression.
- `AGENTS.md`, `roadmap.md`, `GITHUB_EXECUTION.md`: architecture, task status and operation documentation.

Added:
- `src/server/execution/conversation.ts` and `conversation.test.ts`: bounded explicit natural request parsing and config detection.
- `src/server/execution/events.ts` and `events.test.ts`: signed, independently verified owner-scoped GitHub results.
- `src/routes/api/public/github/execution.ts`: authenticated GitHub event receiver.
- `drizzle/migrations/0002_execution_notifications.sql`: nullable notification-state column, applied; generated database types updated.

Observed results:
- All **25 automated tests passed** across six test files, including prior execution/format/routing regressions, natural opt-in without dispatch, owner filtering, credential rejection, valid/modified signatures, mismatched commits, repeated states and honest completion reporting.
- Current preview build reports **build OK**.
- Browser opened the unchanged homepage; unsigned GitHub and Telegram callback requests both returned **401**.
- Using **Raju's GitHub API**, repository metadata and root contents returned **HTTP 200**. Connected scopes include `repo` and `workflow`, and repository permissions include `admin` and `push`.
- `sameerhasan8860-bot/raju-chatbot-companion` is **public** and contains the existing Lovable app. It was not modified through the execution API. No execution workflow, webhook or real test run was created there.

Remaining live verification: provide a private empty dedicated test repository, configure its name, and confirm a project in the owning Telegram chat. Then verify creation, dispatch, signed progress delivery, actual test outcome, logs, fix/rerun and cancellation. Real ordinary-chat/memory interaction in Telegram was not exercised in this update; source flow is preserved and automated regressions passed. The feature is not claimed fully working end-to-end until those live checks succeed.