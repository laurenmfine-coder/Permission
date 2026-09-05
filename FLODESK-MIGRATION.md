# Loops to Flodesk migration

Every email capture on laurenfine.com now writes to Flodesk instead of Loops.

## Set these in Vercel before deploying

Project -> Settings -> Environment Variables:

| Variable | Required | Where it comes from |
| --- | --- | --- |
| `FLODESK_API_KEY` | yes | Flodesk -> My Account -> Integrations -> API keys. Paid plans only. |
| `FLODESK_SEGMENT_ID` | recommended | The segment every site signup lands in. Flodesk workflows trigger on segment membership, so without this a subscriber is created but no welcome email fires. Comma-separate for more than one. |

`LOOPS_API_KEY`, `NOTIFY_EMAIL`, `LOOPS_TRANSACTIONAL_ID` and
`LOOPS_QUESTION_TRANSACTIONAL_ID` are no longer read by anything and can be
deleted.

## What changed

**New: `api/_flodesk.js`** — shared client. Upserts a subscriber via
`POST https://api.flodesk.com/v1/subscribers`, HTTP Basic auth with the API
key as the username.

**New: `api/subscribe.js`** — one endpoint every signup posts to. Takes JSON
or form-encoded bodies, so the widgets only needed a URL swap. Keeps the
honeypot and the email validation from the old code.

**Repointed to `/api/subscribe`:** the exit-intent popup and homepage scroll
widget (`js/capture-widgets.js`), the homepage entry gate
(`js/entry-gate.js`), `media.html`, the quiz result gate (`quiz.html`), the
secondary form on `resources.html`, the `/join` page (`join-emails.html`),
and the free-session form (`free-session.html`).

**`api/download.js`** — worksheet downloads are still gated on a real
server-side write, but the write is now Flodesk. Nothing about the gate or
the PDF delivery changed.

**Removed: `api/intake.js`, `api/question.js`, `js/ask-box.js`.**
Booking a free session runs through Calendly, which already emails you.
Questions go to reasondxcoaching@gmail.com. The anonymous question box on
free-session, coaching and writing-services is replaced with a plain
"email me" block, so nothing depends on a transactional send any more.
Flodesk has no transactional email, so this removes the last thing that
would have needed one.

## Where each signup shows up in Flodesk

All of them land in the segment named by `FLODESK_SEGMENT_ID`. What varies is
the custom fields, so you can still tell them apart:

| Custom field | Values you will see |
| --- | --- |
| `source` | `join-page`, `free-session-page`, `QuizPage`, `Free Resources`, plus the per-widget source strings |
| `lead_stage` | `worksheet_download`, `entry_gate_updates`, `quiz_result_*`, `substack_reader` |
| `notes` | UTM parameters and referrer |
| `situation`, `focus` | free-session form answers |

If a custom field does not exist on the Flodesk account, Flodesk ignores it
rather than erroring, so add them in Flodesk if you want them visible.

## Before you deploy

1. Create the segment in Flodesk and copy its id into `FLODESK_SEGMENT_ID`.
2. Point the Flodesk welcome workflow at that segment.
3. Submit one test signup on the live site and confirm the subscriber appears.
