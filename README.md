# Family Research

A small PWA for a freelance genealogy researcher. Clients book consultations or research time,
follow their research question, the checklist of things they've been asked to gather, notes and
findings, and see what's paid. Built with Vue 3, TypeScript and Vite, and
backed entirely by Firebase on the **Spark (free) plan**: Hosting, Authentication (Google) and
Firestore. There is no server code. Every rule the browser can't be trusted to enforce is in
`firestore.rules`, and `tests/rules.test.mjs` covers those rules.

## Languages: Spanish and English

The UI is fully bilingual. **Spanish is the default** (the business is in Chile); a browser set to
English starts in English, and the **ES / EN** button in the header switches at any time.

- **Remembered:** on the device, and on the account (`users/{uid}.locale`), so another device, and
  future notification emails, use the same language. A choice made on this device wins; otherwise the
  account's applies.
- **Dates and times** follow the chosen language (`es-CL` style, 24-hour clock in Spanish).
- **Wording:** Spanish uses the friendly *tú* form; roles are *Genealogista* and *Cliente*
  (gender-neutral); sign in/out is *Entrar / Salir*, so the account "sesión" isn't confused with a
  research session.
- **Strings** live in `src/i18n/en.ts` (the source of keys) and `src/i18n/es.ts`. The TypeScript
  type and `tests/i18n.test.ts` make sure both have the same keys, placeholders and plural forms, so
  a missing translation fails the build or the tests rather than showing up on screen.
- **The public overview** is written in both languages (ES/EN tabs when editing); visitors see theirs,
  or the other one if only one exists.
- **What people type** (research questions, notes, findings, checklist items) is shown as written.

## Look and language

The design is **warm modern**, chosen to avoid the usual genealogy-site look (parchment, sepia,
family-tree and leaf motifs, heritage greens, ornate serifs).

- **Colour:** plum (`--accent`) for actions, apricot (`--apricot`) for warmth and progress, on warm
  neutrals. It never uses pure white or black. All tokens are at the top of `src/style.css`, with a
  light and a dark set; every text pairing meets WCAG AA.
- **Type:** Fraunces (soft cut) for headings and Figtree for text, both bundled with the app, so
  no Google Fonts requests and they work offline. The base size is 17px for comfortable reading.
- **Theme:** Auto (follows the device) / Light / Dark, from the button in the header. The choice is
  remembered per device and applied before the page paints, so there is no flash.
- **Mark:** two overlapping circles (two people, two generations) on plum.
- **Words:** Researcher and Client; research question; checklist; notes; findings. All UI text is
  in `src/i18n/`; the business name is in `src/copy.ts`. Set the real
  business name with `VITE_APP_NAME` in `.env.local`; it's used for the header, the tab title and
  the installed app.
- **Motion:** minimal, and switched off when the device asks for reduced motion.

## How it works

Each role lands on its own dashboard after signing in. Progress is measured by tasks: the
share of checklist items the researcher has ticked off. If nothing has been assigned
yet, it shows "No tasks yet" rather than 0%.

Every request and session has its own page (`/sessions/:id`), shared by both roles. It shows the
**research question** (title), the time in each viewer's zone, the session's **checklist** with a progress bar, a
**notes** thread that the researcher and the client both post to, the researcher's **findings**, and the
payment status.

There are two lanes.

**Client lane** (any Google account)
- **Dashboard**: overall progress %, upcoming / pending / unpaid counts, next session, open tasks,
  and recent sessions, each with its own progress bar.
- **Book**: ask a research question (required), pick 1–3 open times, and say whether it's
  a consultation or research time.
- **My sessions**: see requests awaiting confirmation, upcoming and past sessions, each session's
  payment status (*Paid* / *Payment pending*) and the researcher's findings. A request can be withdrawn
  until it is confirmed.
- **Checklist**: things the researcher has asked them to gather or find out, with due dates and status.

**Admin lane** (accounts listed in `admins/`)
- **Dashboard**: requests to confirm, upcoming and unpaid sessions, overall task completion, next
  sessions, and one card per client with their progress %. Each card opens a **client page** with
  all their sessions and tasks.
- **Availability**: open a time window on a date (e.g. Sat 14:00–18:00) in 30/45/60/90/120-minute
  slots. Slots that overlap existing ones are skipped.
- **Requests**: each pending request shows its options and whether each one is still open. *Confirm
  this* books the slot and confirms the request in a single transaction, so two clients can't both
  be confirmed for the same slot.
- **Sessions**: list of sessions. On a session's page the researcher edits the research question,
  adds checklist items, posts notes, marks payment, writes the findings, marks it completed, or cancels it (which
  reopens the slot).
- **Checklists**: every item across clients, plus general items not tied to a session. Only the
  researcher can tick an item off; clients see the status.
- **Home**: edit the public overview text.

## Timezones

The researcher and the clients are usually in different timezones, so every time is shown in the
viewer's own zone:

- **Researcher:** sets their zone once on the Availability page; it's saved in `content/settings`.
  Availability is typed in that zone ("Sat 14:00–18:00" means the researcher's 14:00), even from a
  laptop that is on another zone while travelling. All admin screens show times in it.
- **Client:** sees open slots, grouped by *their* calendar day, in their device's zone. A researcher's
  Saturday evening can be a client's Sunday morning. They can pin a different zone (saved to their
  profile), and the app points out when the device's zone differs from the pinned one.
- **Requests and sessions** record the client's zone, so the researcher also sees "their time: Sun ·
  06:00–07:00 · Madrid (GMT+1)" next to each option.
- **Due dates** are plain calendar dates (`yyyy-mm-dd`), the same day for everyone.

Slots are stored as UTC instants, so each viewer's display handles DST on its own.
`src/timezone.ts` converts between wall-clock times and instants using `Intl` only. Its tests
(`npm run test:unit`) cover DST transitions, the spring-forward gap and the fall-back overlap.

## Data model (Firestore)

| Collection | Written by | Notes |
|---|---|---|
| `admins/{uid}` | console only | Its existence makes a user an admin. |
| `users/{uid}` | that user | Profile mirror written on sign-in; `timeZone` (pinned), `detectedTimeZone`, `locale` (`es`\|`en`). |
| `content/overview` | admin | Public landing text, `{ es: {title, body}, en: {title, body} }`. |
| `content/settings` | admin | `tutorTimeZone`. |
| `slots/{id}` | admin | `start`, `durationMin`, `status: open\|booked`, `bookingId`. |
| `bookings/{id}` | user creates, admin manages | `title` (goal, 1–120 chars), `options[1..3]`, `userTimeZone`, `status`, `confirmed`, `payment`, `summary`. |
| `bookings/{id}/notes/{id}` | researcher and that client | Append-only thread: `authorId`, `role: tutor\|student`, `text`; authors and the researcher may delete. |
| `tasks/{id}` | admin | `userId`, `bookingId` (session, optional), `title`, `details`, `dueDate` (yyyy-mm-dd), `status: open\|done`. |

Stored field names and values (`tutorTimeZone`, `role: tutor|student`, `kind: tutoring|freelance`) keep
their original names so existing data stays valid; only the labels changed.

Queries filter on a single field and sort on the client, so no composite indexes are needed.

## Local development (no Firebase project needed)

The emulator needs **Java 21+** on `PATH`.

```bash
npm install
npm run emulators          # terminal 1: Auth + Firestore emulators, UI at http://127.0.0.1:4000
npm run dev:emu            # terminal 2: app at http://localhost:5173
npm run dev:lan            # emulators + dev server open to your local network (see below)
npm run dev:lan:live       # the same, but connected to the real Firebase project (see below)
npm run test:rules         # security rules tests (starts its own emulator)
npm run test:unit          # timezone conversion and translation-parity tests (no emulator needed)
npm run test:e2e           # browser walk-through (researcher in Santiago, client in Madrid, then Spanish);
                           # starts its own emulators + dev server. First time: npx playwright install chromium
```

Sign in with the emulator's fake Google account chooser. To make that account an admin:
1. Open the Emulator UI, go to **Authentication**, and copy the user's UID.
2. Go to **Firestore** and create collection `admins` with document ID = that UID (any field,
   e.g. `email`).
3. Reload the app.

### Browsing from another device (phone, second laptop)

```bash
npm run dev:lan
```

Starts the emulators and the dev server together and prints an address such as
`http://192.168.0.191:5173/` to open on any device on the same network. Ctrl+C stops both.

- Sign in with the emulator's fake account form, not real Google. Firebase only allows Google
  sign-in from authorized domains, never a bare IP address.
- The emulators accept any fake sign-in and have no real security, so use this on a network you trust.
- The installable-app features (offline, "add to home screen") need HTTPS, so they aren't available at
  a plain `http://` IP address. Everything else works.
- If another device can't connect, the machine's firewall may be blocking ports 5173, 8080 and 9099.

#### Same, against the real Firebase project

```bash
npm run dev:lan:live
```

Serves the dev server to the network using the config in `.env.local`: **real data, real Google
sign-in**. Firebase only starts a sign-in from a domain *name* on its authorized list, never a bare IP, so
the script prints an address like `http://192-168-0-191.sslip.io:5173/`. (sslip.io is a public DNS
service that maps `a-b-c-d.sslip.io` to the IP `a.b.c.d`.) One-time, add that name under Firebase
console → Authentication → Settings → **Authorized domains**.

- The name embeds the machine's IP, so if the IP changes (DHCP), authorize the new name too.
- Remove names you no longer use. Anyone who can serve a page from that same private IP on another
  network could present it as an authorized sign-in origin, so don't leave stale ones.
- Some routers refuse to resolve public names to private addresses ("DNS rebinding protection"); if
  the name doesn't load, allow `sslip.io` in the router or use the IP address for browsing and the
  `localhost` address on this machine for sign-in.

## Deploying to Firebase (free)

### One-time: the Firebase project
1. Create a project at https://console.firebase.google.com and stay on the **Spark** plan. Firestore
   location: pick one near the business (e.g. `southamerica-west1`, Santiago); it can't be changed later.
2. **Authentication → Sign-in method**: enable **Google**.
3. **Firestore Database**: create it in production mode.
4. **Project settings → Your apps**: add a Web app and note its `apiKey`, `authDomain` and `appId`.

### One-time: let GitHub deploy (no keys stored)
`.github/workflows/pipeline.yml` deploys from GitHub Actions using **Workload Identity Federation**:
GitHub proves which repository and branch is running, and Google hands back short-lived credentials.
There is no service-account key to leak or rotate.

```bash
gcloud auth login                                     # as a project owner
scripts/setup-github-deploy.sh <firebase-project-id> <github-owner/repo>
```

The script creates a `github-deployer` service account with only the deploy roles (Hosting, Firestore
rules and indexes), and an identity provider that **only accepts `<owner/repo>` on `main`**. Then set
these **repository variables** (Settings → Secrets and variables → Actions → *Variables*; none are
secret, the script prints ready-made `gh variable set` commands):

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | the project id |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID` | from step 4 |
| `VITE_APP_NAME` | the business name (optional) |
| `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` | printed by the script |

### The pipeline
| On | Runs |
|---|---|
| every pull request and push | typecheck + build + unit tests · Firestore rules tests · browser walk-through (both languages, light/dark), with screenshots uploaded as the `e2e-screenshots` artifact |
| push to `main`, all of the above green | build with the production config, then `firebase deploy --only hosting,firestore` (site, rules, indexes) to the `production` environment |

Rules deploy together with the code that depends on them, so the two never drift. A deploy job won't
start if a variable is missing; it names the missing one. Re-running a deploy is safe.

Suggested GitHub setting: protect `main` (Settings → Branches) and require the three check jobs,
so only green code reaches it.

### After the first deploy
1. Sign in once on the site, then create `admins/{your uid}` in the Firestore console (the UID is
   under Authentication → Users). Reload, open **Availability** and confirm your timezone.
2. If you add a custom domain, add it under **Authentication → Settings → Authorized domains**.

### Deploying by hand (fallback)
```bash
npx firebase login
npx firebase use --add      # pick the project; writes .firebaserc
cp .env.example .env.local  # fill in the web config
npm run deploy              # builds, then deploys hosting + firestore rules
```

### Free-tier headroom

The Spark plan includes 50k Firestore reads, 20k writes and 1 GiB storage per day, plus 10 GB of
Hosting storage and 360 MB of transfer per day. With a handful of clients and a few sessions a
month, usage stays far below these limits. The persistent Firestore cache also means repeat
visits re-read very little.

## Known limitations of this prototype

- There are no notifications (email/push). Those need Cloud Functions, which require the Blaze
  plan. Users see status changes live while the app is open.
- Sign-in uses a popup. On iOS, when the app is installed to the home screen, the popup can be
  unreliable; using the site in Safari works.
- Payment is tracked, not processed: the researcher marks a session paid after receiving payment,
  usually by bank transfer. Options for in-app transfer details, clients abroad, and online payments
  are in [docs/payments.md](docs/payments.md).
