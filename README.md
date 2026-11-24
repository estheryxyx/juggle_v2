# Juggle

A personal planner for one user (Esther, a Cambridge student who runs several societies). It turns a pasted or typed to-do list into categorised to-dos and calendar events, tracks time per category against weekly limits, and keeps deadlines, notes and long-term goals in view.

The app is one page, `index.html` (markup, styles and one script), plus `config.js` for settings and `supabase/schema.sql` for the database. No build step. It is hosted on Vercel from this GitHub repository. Outside libraries: two Google Fonts, `@supabase/supabase-js` 2.45.4 from jsDelivr, and Google Identity Services (`accounts.google.com/gsi/client`).

## What matters most

1. **Deadlines.** The user tends to start deadline work too late. Anything that touches deadlines should make the start date more visible, never less. The rule today: start-by date = deadline, minus one buffer day, minus one day per two hours of estimated work (`startByOf`).
2. **Minimal look.** She rejected an earlier version for being cluttered. Three quiet columns (list, calendar, side panel). No new always-visible controls unless asked; prefer a tab, a dialog or a line of text. The running timer is the only loud element.
3. **Typing first.** Most input arrives as a pasted list in her own shorthand. New features should be reachable by typing in the capture box where that makes sense.

## Her shorthand

- `supo`: supervision (a small-group teaching session). `DoS`: Director of Studies.
- `li5`, `li15`, `pbs01`: paper (course) codes. `diss`: dissertation.
- `JCR`: college student committee. `soc`: society (Travel Soc, Consulting Soc, Wine Soc and others).
- Each society is its own category. Categories, colours, keywords and weekly limits are user data, edited in the Categories dialog. Do not hard-code new ones; `DEFAULT_CATS` is only the first-run seed.

## Capture syntax (the parser)

The pure parsing code sits between the `/*PARSER-START*/` and `/*PARSER-END*/` markers and has no DOM access, so it can be run in Node.

- A day or date on its own line (`monday`, `next fri`, `2 dec`, `later`) sets the day for the lines below it.
- A day or date inside a line (`dinner thu 7pm`, `lunch tmr 1pm`) moves just that line. "next week", "eow" and "end of month" only count after `by`/`due`.
- A time in a line makes a calendar event: `11am`, `2-3pm`, `7.30`, `14:00`, or `@11` / `@1-3` when there is no am/pm. Plain numbers ("supo 11", "chapter 11", "pages 1-3") are never times. Hours 1 to 7 without am/pm are read as afternoon.
- `[]` at the start of a line with a time makes a to-do scheduled at that time instead of an event.
- The in-app "All shorthand" dialog lists all of this; keep it in step with the parser.
- `by fri` / `due 30 nov` sets a deadline. `(4h)` or `~4h` sets the estimate. `!` at the start or end marks it important.
- `and then` splits one line into ordered to-dos. A trailing `?` marks a maybe.
- `note: ...` creates a note under the best-matching category.
- `soon` on its own line, or `soon:` before a to-do, puts it in the Soon bucket (no date, `soon: true`). `later` puts undated to-dos in Later (`soon` false).
- Category = the one whose keywords match most often (ties go to the longer match), else `unsorted`.

When changing the parser, keep a `tests/` folder (create it on the first parser change) with example lists and expected output, and keep every existing case passing.

## Data

All state is one object (`state`), kept in `localStorage` under `daybook.v1` (the app was first called Daybook; keep the key so existing data loads) and, when signed in, in Supabase.

- `cats`: `{id, name, color, limit (hours/week or null), kw[]}`
- `tasks`: `{id, title, cat, date (YYYY-MM-DD, or null = Soon/Later), soon, added (ms), start (minutes or null), dur, done, maybe, important, due, est (hours), goal, q (matrix quadrant), gid (Google event id), order}`
- `blocks`: `{id, kind: 'focus'|'event', title, cat, date, start, dur, repeat: ''|'daily'|'weekdays'|'weekly', gid}`
- `notes`: `{id, cat, text}`
- `goals`: `{id, title, cat, due}`; a goal's steps are tasks with `goal` set
- `joys`: `{id, text, date}`, the "Looking forward to" list
- `sessions`: `{t (task id or null), cat, s, e}` timer records; `timer`: the running timer or null

Always go through `normalize()` when loading, and call `commit()` after any change (it stamps `updatedAt`, saves, syncs and re-renders). The Backup dialog exports and restores this whole object.

## Accounts and sync (Supabase)

- Sign-in is passwordless email: `signInWithOtp` sends a link (and a code, if the email template includes `{{ .Token }}`). `verifyOtp` handles the code.
- Each user has one row in `juggle_state` (`user_id`, `state` jsonb, `updated_at`), protected by row-level security so only its owner can read or write it. Schema: `supabase/schema.sql`.
- Sync is whole-state, last writer wins on `state.updatedAt`. `pull()` runs on sign-in, on returning to the tab, every 60 s and on a realtime change; `push()` is debounced after every `commit()`.
- A device never pushes before its first successful pull after sign-in (`hydrated`). On a device signing in for the first time, local items are merged into the account by id (`mergeInto`) instead of overwriting it.
- Signing out uploads unsaved changes, then clears this device's copy.
- If `config.js` is empty, the app runs without sign-in and saves on the device only.
- Two devices editing within the same few seconds can lose one side's edit. If that becomes a problem, move to per-item rows.

## Google Calendar

- Set `googleClientId` in `config.js` to switch it on. It uses the Google Identity Services token client in the browser: no server, no refresh token.
- Scope: `calendar.events` (read events, create events). Calendars shown are listed in `GCALS`; an empty id means the signed-in account's primary calendar. A calendar that returns 403 or 404 is skipped quietly.
- The access token lasts about an hour and is kept in `localStorage` (`daybook.gtok`). When it expires the calendar shows "Reconnect Google Calendar"; one click gets a new token without the consent screen. Keeping it connected for longer needs a server-side OAuth flow with refresh tokens (e.g. Supabase's Google provider or a Vercel function).
- Reading: `gLoadDirect` (Calendar API, `singleEvents=true` so recurring events arrive expanded) feeds the same `gTake`/`gMerge`/`gOn` pipeline as before. Adding: the `edG` handler posts to the primary calendar.

## Leftovers from the Claude-hosted version

The file was first built as a Claude artifact. Some code still calls `window.claude.use(...)`, which does not exist on Vercel, so those paths stay inactive (the `mcp` calendar path only runs when `googleClientId` is empty):

| Feature | Code | What to build instead |
|---|---|---|
| "Sort with Claude", goal steps, matrix suggestions | `aiSort`, `suggestSteps`, `mxRun` (via `sample`) | A Vercel serverless function in `api/` that calls the Claude API, with the key in Vercel environment variables. Reuse the prompts as they are |
| Backup download prompt | `downloads` | Already falls back to a normal browser download |

`GCALS` lists the calendars shown. It contains a personal email address as a calendar ID, so keep the repository private or move that value to `config.js`.

## Timer, insights and colours

- Every timer belongs to a to-do. A timer started from a category shows a "Which to-do?" picker in the header (or "+ New to-do…"); `assignTimer` attaches it. Timers start from the ▶ on list rows, on calendar to-do blocks (day view) and in the editor.
- Finishing a to-do (`setDone`, used by every tick box and the header's ✓ Done) stops its timer and sets its calendar length to the total time tracked on it, rounded to 5 minutes (`amendTask`). If it had no time slot, it is placed where the last session started. `doneAt` records when it was finished.
- `stopTimer` applies the same length update whenever a timer of a minute or more stops.
- `estStats()` compares estimates with tracked time on finished to-dos. After three of them, start-by dates scale estimates by that ratio (capped at 3×) so deadline work is suggested earlier.
- Insights ends with a backlog per category (`backlogHtml`): to-dos dated, due, finished or timed in the selected range, split into open, done and waiting in Soon/Later. Rows open the editor.
- Left-column sections (Looking forward to, Deadlines, Important, Goals) collapse; state is kept per device in `daybook.folds`.
- Prioritise, Categories and Backup live in the header's ⋯ menu so the header fits one row with a timer running.
- Insights (`renderDash`, header button, `#insights`) is drawn by hand in SVG and HTML: stacked day/week columns, category totals against limits, a weekday × hour heatmap, estimates and biggest to-dos. Sessions are kept for 200 days so the 13-week view can compare with the 13 weeks before.
- Category colours default to a palette checked for colour-blind separation in light and dark mode (`PAL`, `DARKSTEP`); always colour by category through `cc(cat)`, which swaps to the dark-mode step. Charts never show more than 8 categories; the rest fold into "Other".
- On the calendar, events are filled blocks, to-dos are outlined with a tick circle, and focus blocks are hatched.
- Google events are hidden when Juggle already has an event within 30 minutes with a similar title (`similarT`: same letters, one containing the other, or bigram overlap of 0.6 or more), and when the same event comes from two calendars.
- Block titles wrap at word boundaries and are clamped to the lines the block's height allows (`--lc`).
- The header timer can shrink to a small pill, and the side panel can collapse to a thin rail; both are remembered per device.

## Working rules

- First job: split `index.html` into separate files (parser, state and storage, list, calendar, timer, side panel, dialogs) without changing behaviour. Verify by running the parser tests and clicking through each feature.
- One feature per change, on a branch. Check the Vercel preview deployment before merging.
- Never commit a Supabase service-role key or a Claude API key. Only the anon key belongs in `config.js`.
- Light and dark themes both use the colour tokens at the top of the stylesheet. Never put a colour directly on an element.
- Drag and drop uses pointer events, not HTML5 drag, so it works on touch. On touch, only the grip handle starts a drag.
- No `alert`, `confirm` or `prompt`. Use the existing `<dialog>` pattern.
- Do not add a "didn't finish" or failure marker to to-dos. Unfinished to-dos carry over quietly.