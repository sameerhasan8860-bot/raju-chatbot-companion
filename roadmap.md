# GitHub Actions execution
- [ ] Add natural-language review of previously generated code, required configuration detection and approved fixes.
- [ ] Add verified GitHub event notifications without polling or credentials inside generated projects.
- [ ] Recheck the requested repository, run regression checks, and document remaining live setup.
- [x] Add opt-in Telegram project preparation and confirmation, preserving normal chat.
- [x] Add owner-scoped project/job storage and GitHub API integration.
- [x] Add fixed, bounded sandbox workflow, status/logs/cancel/rerun.
- [x] Test permissions, confirmation, normal-chat bypass and result reporting (17 automated checks passed).
- [ ] Verify a real Telegram-to-GitHub run: blocked because configured repository is public and contains unrelated files; requires a private empty dedicated test repository and the user's Telegram confirmation.