# MessWise

**Your meal, minus the wait.**

[Student login](https://messwise-mocha.vercel.app) | [Staff login](https://messwise-mocha.vercel.app/staff) | [GitHub](https://github.com/Aravch07/Messwise)

A hostel dining platform inspired by SeatWise, with student accounts, numbered dining passes, a staff control room and food planning based on recorded demand. Built with a responsive dark interface, lime and lavender accents, mobile navigation, visible service states and transparent food accounting.

## What works

| Students | Mess staff |
| --- | --- |
| Create an account or sign in across devices | Sign in to the protected control room |
| View daily breakfast, lunch and dinner menus | Edit menus, notices and serving meal |
| Confirm which meals they plan to eat | See demand confirmations and preparation estimates |
| Join a numbered queue and see people ahead | Call next or choose a specific token |
| Follow live serving updates every second | Pause service while food is unavailable |
| Keep the same queue place after refresh or sign-in | Add ready portions, serve or skip called tokens |
| Cancel a waiting token | Record waste, export CSV and inspect activity |

Each account can have one active token and collect each meal once per day. The kitchen reserves one portion when a token is called. Serving consumes that reservation; skipping returns it to ready stock. A called token must be resolved before another is called. Food cannot be called when stock is empty. Duplicate requests do not create duplicate active tokens.

## Run locally

Node.js 22 or newer. Run npm install to install the Vercel Blob storage SDK. No build step is required.

```powershell
Copy-Item .env.example .env.local
```

Set ADMIN_PASSWORD to a private staff password and SESSION_SECRET to a random string of at least 32 characters in .env.local. Then:

```powershell
npm run dev
```

Open http://localhost:3000. Create student accounts through Student sign in. Staff use the separate /staff portal; students are never shown staff navigation. Add ready portions before calling students. Use two separate accounts to demonstrate queue progression.

## Vercel deployment

Import this repository into Vercel. Framework: Other. Build command: leave empty. Output directory: public. Node runtime: 22 or newer.

Set these private server environment variables before deploying:

| Variable | Purpose |
| --- | --- |
| ADMIN_PASSWORD | Staff control room access |
| SESSION_SECRET | At least 32 characters, shared across all instances |
| UPSTASH_REDIS_REST_URL | Shared Redis REST endpoint |
| UPSTASH_REDIS_REST_TOKEN | Private Redis credential |

Production uses the connected private Vercel Blob store in Singapore. Set BLOB_STORE_ID from that connection; Vercel supplies short-lived OIDC credentials automatically. Reads bypass the CDN, and writes require the exact ETag of the state that was read. A concurrent change triggers a retry. Upstash Redis remains an optional alternative. The production app refuses to process live state without shared storage and a configured signing secret. A local file is used only outside Vercel. Never put environment values in public JavaScript or commit them to GitHub.

Vercel routes /api/* to api/index.js. Public assets are served from public/. The API uses Node built-ins, fetch and the official Vercel Blob SDK.

## Architecture

- **Interface:** semantic HTML, custom responsive CSS, JavaScript modules, native accessible dialogs. Dynamic user content is HTML-escaped; requests are same-origin.
- **API:** Node serverless handler with server-side role checks and input validation.
- **Identity:** scrypt-hashed student passwords with individual random salts; signed expiring HttpOnly cookies. Passwords and identity records are excluded from public API responses. Cookies are Secure in production.
- **Abuse controls:** shared ten-minute authentication attempt limits using a hashed network identifier. No raw IP address is stored.
- **Concurrency:** private Vercel Blob conditional writes use ETag-based optimistic concurrency and uncached origin reads across instances. Optional Redis uses a compare-and-swap Lua script. Local storage serializes requests and atomically renames file writes.
- **Accounting:** prepared portions reconcile to served meals, called reservations, ready food and recorded waste. Day rollover records unaccounted food explicitly instead of reporting it as served or wasted.
- **Audit:** the latest 300 action records, visible only to staff. The dashboard displays the latest 20.
- **Delivery:** security headers, a restricted Content Security Policy, and GitHub Actions checks on pushes and pull requests.

## Planning and analytics

Student meal confirmations help the kitchen predict demand before students join the serving queue. The preparation estimate uses the greatest of recent same-meal attendance, current served plus queued demand, and meal confirmations. It adds a 5% buffer for remaining demand and subtracts ready portions. This is an explainable heuristic, not machine learning or a claim of guaranteed demand.

Charts use up to seven recorded days. Initial metrics are zero. The editable menu is example content. Wait times assume 90 seconds per student and show on hold during pauses or empty stock. Staff should adjust estimates for walk-ins, serving speed and menu popularity.

Daily state uses Asia/Kolkata. Date rollover is processed on the next read or mutation, resetting tokens and preserving meal attendance history. History retains the last 90 meal summaries. Kitchen records are retained for CSV export.

## Verification

```powershell
npm test
```

Tests cover FIFO order, stock limits, specific-token calling, skipped portion recovery, pauses, date rollover, duplicate accounts, sign-in, cross-device identity, ownership, role enforcement, origin rejection, concurrent duplicate joins and repeat meal prevention. Tests use an isolated temporary directory. CI also validates client and API JavaScript syntax.

## Scope

Student email ownership and hostel membership are not verified. Password reset, staff invitation workflows, multiple messes, background push notifications and institutional SSO are not implemented. Keep the page open to receive serving updates. The single shared state key prioritizes simple correctness for a college demonstration; it needs load testing and partitioned storage before a large campus rollout.

Production is deployed on Vercel in Singapore. Live checks verified public page/assets, staff authentication, concurrent persistent writes and readback. Eleven local tests pass, including SDK error identity and stale-read suppression. Browser visual QA remains unverified in this environment.

Queue conflicts retry using the SDK error class rather than Error.name, with a short randomized delay. Blob reads no longer wait behind unrelated requests in a function instance. Successful actions update the interface immediately from the response; single-flight one-second polling discards stale in-flight reads and refreshes on window focus.

## Phase 4 prototype and role access

The landing page now requires student login before dining data is returned. Staff sign in separately at /staff using the existing staff password. The API requires the staff portal context AND a valid server-signed staff session for administrative operations; hiding a navigation item alone is not the security control. Student responses exclude kitchen logs, staff activity, team records, and other participants' feedback.

Staff Prototype studio maps the six 20-mark rubric criteria (120 total), records team details and the original problem/selected solution, tracks real user task outcomes and timings, and documents before-and-after improvements. Students can voluntarily submit task feedback after signing in. Multiple tasks from one account retain one participant code. No user validation results, photographs, videos, or marks are fabricated.

Collect genuine validation from 3-5 distinct relevant users, attach initial and final prototype photos and process evidence, record a 2-3 minute demonstration, and enter the team's original statement and actual contributions. The studio exports an editable-content HTML submission report, printable HTML presentation slides, and JSON project records. Open the HTML files in a browser and print to PDF if required. Faculty assign marks; the tracker does not guarantee a score.

The challenge date from the supplied brief is 24 November 2026. The final presentation and validation date is 30 November 2026. The studio includes the complete two-hour activity plan and a 150-second demo storyboard.
