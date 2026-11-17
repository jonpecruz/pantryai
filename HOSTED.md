# Separate Publik deployment

This branch powers https://pantryai-publik.vercel.app, a separate deployment from the original private household app. Do not merge it into the original deployment without reviewing the authentication and database changes.

## Infrastructure

- Vercel project: `jonpecruzs-projects/pantryai-publik`
- Supabase project: `dybxmevdgzlvbvwgsoax`
- Publik app slug: `pantryai`
- Install dependencies with `npm ci`, build with `npm run build`, and run with `npm run start`.
- Vercel must use the Next.js framework preset; `vercel.json` sets it explicitly.

## Configuration

The Vercel production environment needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key is supported), `SUPABASE_SERVICE_ROLE_KEY` (the server secret key is supported), `PUBLIK_APP_TOKEN`, and a stable random `PUBLIK_INSTALL_SECRET` of at least 32 characters. Never expose the last three to browsers or commit them.

Use `supabase/hosted.sql` only in the separate project. Its pantry backup is owned by `auth.uid()`. Publik records and own-provider keys are encrypted with AES-256-GCM and are accessible only to the server. Keep `PUBLIK_INSTALL_SECRET` stable: changing it invalidates existing encrypted records.

Set Supabase's Site URL to the production app URL. Email/password sign-in is followed by the mandatory Publik gate, then the AI plan or own-key choice. Supabase email delivery settings may need production SMTP configuration before opening registration broadly.

## User data

The app keeps its local-first behavior. Local storage is scoped to the signed-in user, and a debounced backup goes to that user's `user_state` row. It does not automatically overwrite device data from a cloud backup. Authenticated HTML, API responses, and credential pages are excluded from the service worker cache. Access to the app requires an online sign-in check.

The Gemini own-key option is entered on the AI & account page. Publik provides OpenAI-compatible chat, including image input for receipt analysis. Users may opt out of usage counting there.

## Verification

Check the production build, signed-out redirects and API rejection, anonymous database rejection, tenant isolation, the first post-login Publik gate, an AI request (or its explicit 402 response), and the own-key path. The hosted integration has no binary `PUBLIK_SELF_TEST`.

The original Publik listing was derived as `local_web`. Its hosted URL and source branch still require review in Publik's owner dashboard; the documented submission endpoint does not update an already-listed repository.
