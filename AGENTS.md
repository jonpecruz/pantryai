## publik API
- Base URL: https://publikhq.com/api/v1 (OpenAI Chat Completions)
- Models: publik-fast, publik-balanced, publik-smart; never a bare vendor model.
- The server layout calls ensureUser(userId) before the first app screen. Protect API handlers separately.
- The module sends app_opened and active_session; respect usage opt-out.
- PUBLIK_APP_TOKEN and PUBLIK_INSTALL_SECRET are server-only. Never commit them.
- Per-user Publik keys and own-provider keys are encrypted in server-only tables. Never print or log keys.
- 402: show error.message and its single error.top_up_url link.
- Show usage percentages, never money.
- Docs: https://publikhq.com/developers and https://publikhq.com/skills/api.md

## Separate hosted deployment
- This branch is for a new Vercel project and a new Supabase project only.
- Use supabase/hosted.sql. Legacy schema.sql and schema_part*.sql are for the original personal deployment.
- Never copy personal deployment environment files or link this directory to the existing Vercel project.
- Verify login, Publik sign-in, API rejection for signed-out users, per-account data isolation, own-key support, and 402 UI before claiming deployment is complete.
