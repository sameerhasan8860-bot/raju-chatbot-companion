# Telegram temporary project testing

## Added capability

The assistant's normal SYSTEM prompt, models, memories, history, existing commands and UI are unchanged. Explicit execution commands activate a separate tool. Python and Node projects can be generated, reviewed and tested without executing any project code on the application backend.

## Owner setup

1. Connect the GitHub **API connector**, not just Lovable Git sync. This project uses the linked GitHub connector through the gateway. Repository contents write and Actions write/workflow permissions are required.
2. Create a **private, dedicated test repository**. It must be empty or contain only README.md. Do not use your Lovable application repository. Set `GITHUB_EXECUTION_REPOSITORY` to `owner/repository` through the secure configuration form.
3. Enable GitHub Actions in that repository. The first user-confirmed test creates `.github/workflows/telegram-sandbox.yml` on the default branch. The service refuses unexpected existing files or workflows rather than overwriting them.
4. Do not add organization/repository secrets for untrusted tests. No Lovable, Telegram or GitHub credentials are passed into generated projects. Tests requiring real credentials or external effects are not supported by this sandbox; configure a separate reviewed deployment integration instead. Never paste credentials in Telegram.

## Telegram flow

- `/execution`: command list and limits.
- `/prepare <requirements>`: generates complete files, README setup/run instructions and test command, without executing. Important missing requirements are returned as a question.
- `/execute <project UUID>`: displays repository, file list, test command, possible GitHub usage costs and effects; stores a pending approval.
- `/confirm <job UUID>`: approves only this job; valid for 30 minutes, consumed atomically. Commits a project manifest on a unique branch and dispatches the fixed workflow.
- `/status`: lists your jobs; `/status <job UUID>` retrieves actual GitHub status and conclusion.
- `/logs <job UUID>`: fetches recent bounded, credential-redacted GitHub output.
- `/cancel <job UUID>`: cancels a pending approval or requests cancellation of an active GitHub run. Cancellation completion is verified by a later status check.
- `/rerun <job UUID>`: creates a fresh approval after the earlier job ends. Never reruns automatically.
- `/hosting`: explains permanent hosting options; the assistant can give server setup instructions without claiming server access.

All verified private-chat Telegram senders may use the tool, but database access is scoped to their sender ID. Users cannot select arbitrary repositories or read/control another user's jobs through the bot. The owner pays any GitHub usage costs; branches are retained for audit and require manual owner cleanup. Users who independently have repository access can see its contents: use this shared repository only with trusted repository collaborators.

## Isolation and limits

The workflow uses read-only repository permissions, checkout without persisted credentials, and no pull-request/push triggers. Files are materialized as data inside a fresh sandbox. Dependency installation happens in a Docker image build on the temporary runner. The test executes as a non-root user in a read-only container, no network, no capabilities, no credentials, 512 MB memory, one CPU, 128 process limit and bounded temporary storage. Dependencies can use network during image build, but no credentials or app environment are supplied to the build. This is not a hardened multi-tenant VM service; GitHub-hosted runners and containers have their own security limitations.

Installation is bounded to eight minutes, tests to five minutes, and the entire job to fifteen minutes. Up to 30 files / 150,000 source characters per project. Python 3.12 and Node 22 are supported. Node package installation disables lifecycle scripts. Projects needing other languages, browser services, online dependencies at runtime, writable source trees, or secrets may fail; do not claim those tests succeeded.

Success means the configured test command exited successfully. It is not independent proof of server startup, health checks or useful test coverage. There is no permanent hosting, public app URL, automatic deployment or infinite runner handover. Once a workflow ends, its application is not running.

## Status delivery and remaining validation

Progress notifications are emitted only for observed actions (files committed, dispatch accepted). Run ID, commit SHA, status and conclusion are stored when the user requests status/logs. No background completion notifications are configured; use `/status` for actual results. Natural-language execution requests are not automatically interpreted: use explicit commands to avoid accidental execution. Existing ordinary code answers are not automatically converted to saved executable projects; `/prepare` creates the reviewed project manifest.

Automated tests verify explicit opt-in, all-user access with sender ownership, cross-user rejection, cancelled/expired approvals, repository boundary checks, sensitive-source rejection, output redaction and honest completion reporting. A real Telegram → GitHub workflow test must be run by an authorized user after the repository passes setup checks. Credentials-dependent tests, deployment and reliable 24/7 hosting remain separate capabilities, not promises of this implementation.

## Files

Changed: `src/server/telegram/bot.ts` (one isolated command hook), `AGENTS.md` (architecture), `src/routes/__root.tsx` (remove generic project metadata).

Added: `src/server/execution/{validation,workflow,github,telegram}.ts`, execution tests, additive migration for `tg_projects` / `tg_jobs`, this guide, roadmap. Existing bot tables and data were not replaced.