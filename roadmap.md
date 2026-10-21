# Azure Quiz Coach — Roadmap

Unofficial Azure exam-practice app (mobile-first, TanStack Start + Lovable Cloud).

## Done
- [x] Lovable Cloud backend enabled; email/password + Google sign-in enabled
- [x] Decision: question generation uses Lovable AI Gateway (built-in models) as a temporary stand-in for a dedicated Anthropic API key

## In progress
- [ ] Design system (calm blue palette, green/amber feedback, light+dark, a11y tokens)
- [ ] Auth foundation: AuthProvider, /auth (tabs + Google), /auth/forgot, /auth/reset, /auth/callback, protected route gate, header with display name + admin link

## Blocked — waiting on user
- [ ] Database schema (profiles, user_roles, user_settings, topics, notes, questions, attempts, answers, ai_usage, has_role, handle_new_user, readiness_inputs view, RLS, seed topics + supabase/seed.sql) — waiting for the user's schema file paste
- [ ] Notes-only system prompt for question generation — waiting for the user's paste

## Todo (after schema)
- [ ] generate-questions generator (Lovable AI now, Anthropic key later): 20 calls/day limit, validation, fallback client-side fill-in-the-blank on 429/502
- [ ] delete-account (server-side account removal, cascades)
- [ ] /practise (topic chips, 5/8/12 selector)
- [ ] /quiz/:attemptId (progress, hints, listen, feedback panel, keyboard)
- [ ] /results/:attemptId (score, per-topic bars, review accordion, actions)
- [ ] /notes (paste notes, counters, save, generate, saved notes list)
- [ ] /readiness (weighted scores, gauge, radar + 14-day line charts, Next up card)
- [ ] /settings (toggles -> user_settings, speech speed, language -> profiles)
- [ ] /admin/questions (admin-only CRUD on built-in questions)
- [ ] Compliance footer everywhere; quality bar (skeletons, empty states, a11y, 44px targets)
