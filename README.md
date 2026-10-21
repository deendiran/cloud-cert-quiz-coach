# Cloud Cert Quiz Coach

Build "Azure Quiz Coach", a mobile-first web app (React, TypeScript, Tailwind,
shadcn/ui) backed by Supabase. It is an UNOFFICIAL exam-practice tool.
Never use Microsoft or Azure logos.

BRANDING AND COMPLIANCE
- Footer on every page, exact text: "Unofficial study aid. Not affiliated with
  or endorsed by Microsoft." Also show it under the title on the landing page
  and on the quiz setup page.
- Calm palette: deep blue primary with variations of blue as secondary, green for correct, amber for incorrect
  (never red), generous spacing, rounded-xl cards. Support light and dark mode.

AUTHENTICATION (Supabase Auth)
- Routes: / (public landing), /auth (tabs: Sign in, Sign up, plus a "Continue
  with Google" button), /auth/forgot, /auth/reset, /auth/callback.
- Sign up: display name, email, password (min 8 chars) with inline validation.
  Require email verification; show a "Check your email" screen with a resend
  button.
- Sign in with email and password. Show clear error text for wrong password or
  unverified email. Forgot-password sends a reset email; /auth/reset sets a new
  password.
- Use an AuthProvider with onAuthStateChange. Protect every route except the
  public ones: signed-out users are redirected to /auth and returned to the
  page they wanted after sign-in. Show a header menu with display name, Settings
  and Sign out. Admin-only link to /admin/questions when the user has the admin
  role (check via user_roles, never via client-editable data).
- Settings page includes "Delete my account", which asks for confirmation and
  calls an edge function delete-account that removes the user and cascades data.

DATABASE
Create these tables exactly as in my schema file (I will paste it next):
profiles, user_roles, user_settings, topics, notes, questions, attempts,
answers, ai_usage, the has_role function, the handle_new_user trigger, the
readiness_inputs view, and Row Level Security so every learner only reads and
writes their own rows. Built-in questions are readable by every signed-in user
only when is_published is true. Seed topics: Cloud basics, Compute, Storage,
Networking, Security, Cost. Create supabase/seed.sql with 2 placeholder
questions per topic that I will replace with my own.

PAGES
1. /practise: card "Let's practise". Topic chips loaded from topics plus a
   "My notes" chip when the user has notes questions (none selected = all).
   Segmented control for 5, 8 or 12 questions. Button "Start quiz" creates an
   attempts row and opens /quiz/:attemptId.
2. /quiz/:attemptId: one question per screen. Progress bar "Question 3 of 8",
   topic name, stem, option buttons labelled A to D (min height 56px, options
   shuffled), a "Show hint" button, a "Listen" button that reads the stem and
   then "Option A ..." through "Option D ...", and a "Stop" button. On tap:
   lock options, mark the chosen option green if correct or amber if not, always
   mark the correct option green, write an answers row, and slide up a feedback
   panel with heading "Nice work!" or "Not quite, here's why", the correct
   answer when wrong, the explanation, and "Memory hook: ..." when present.
   Add a "Listen to answer" button that reads "Correct." or "Not quite. The
   correct answer is ...", then the explanation and hook. Then a "Next
   question" button ("See results" on the last one). Keyboard: 1 to 4 choose,
   Enter for next.
3. /results/:attemptId: score as "7 / 8", one encouraging line that changes by
   score band, per-topic bars, an accordion "Review missed questions" with the
   correct answer and explanation, buttons "Try again", "See my readiness",
   "Practise my weak topics".
4. /notes: textarea "Paste your notes" (80 to 6000 characters, live counter),
   optional title, segmented 3 / 5 / 8, buttons "Make questions", "Listen to
   notes" and "Stop". Save the note, then call the edge function
   generate-questions with { note_id, count } using the user's session. While
   waiting show "Writing questions from your notes...". On 429 or 502 run a
   client-side fallback that builds fill-in-the-blank questions (pick the
   longest word in a sentence as the answer, use 3 other terms from the notes as
   distractors, source = local_generated) and tell the user in plain words that
   a simpler method was used. Below, list saved notes with question counts,
   "Practise this note" and "Delete" (with confirmation).
5. /readiness: weighted per-answer score from the readiness_inputs view.
   Per topic: score = sum(w for correct) / sum(w) * 100; coverage =
   min(1, answers / 8); adjusted = score * (0.6 + 0.4 * coverage). Overall =
   mean of adjusted scores. Show a circular gauge with the label Ready (80+),
   Almost (60-79) or Needs work (below 60), a Recharts radar chart by topic,
   a 14-day line chart of daily accuracy, and a card "Next up: <lowest topic>"
   with a "Practise this topic" button. Empty state: "Take your first quiz to
   see your readiness."
6. /settings: toggles saved to user_settings and applied app-wide: Large text
   (+25%), Dyslexia-friendly font (Verdana, wider letter and line spacing), High
   contrast, Read aloud automatically (speak each question with its options
   after it appears, then the answer after the user responds), Speech speed
   slider 0.5x to 2x, Language (English, Kiswahili) saved to profiles. Use
   window.speechSynthesis for all speech, with a visible Stop button and a
   message if the browser has no speech support.
7. /admin/questions (admin only): table of built-in questions with search,
   create, edit, publish toggle and delete.

EDGE FUNCTIONS (Supabase, Deno)
- generate-questions: JWT required. Confirm the note belongs to the caller,
  limit 20 calls per user per day using ai_usage, call the Anthropic API with
  the key stored in the function secret ANTHROPIC_API_KEY (never in client
  code), validate the JSON (stem, 3-4 distinct options, one correct answer,
  explanation), insert valid questions with owner_id, note_id, topic_label
  "My notes: <title>" and source ai_generated, and return them. Status codes:
  200, 400, 401, 404, 429, 502. System prompt: the notes-only prompt I will
  paste next.
- delete-account: JWT required; deletes the calling user with the service role.

QUALITY BAR
- Loading skeletons, empty states and friendly error messages everywhere. No
  red error styling; say what happened and what to do next.
- Visible focus rings, aria-labels on icon buttons, aria-live on feedback
  panels, color is never the only signal (add icons for correct and incorrect).
- Responsive from 360px wide. Touch targets at least 44px.
- Never store or log the contents of notes outside the notes table.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d5753df4-ee1b-48ee-bebb-3778f6f64922).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
