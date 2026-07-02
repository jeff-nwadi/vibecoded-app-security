# Vibecoded App Security Checklist

Organized by category. Each item: **Risk** (what goes wrong), **Check** (how to spot it), **Fix** (what to do instead). Skip categories that genuinely don't apply to the app (e.g. no file upload feature → skip that section) but read every category at least once before deciding it doesn't apply.

Severity guide used throughout: 🔴 Critical (exploitable now, high impact — data breach, account takeover, financial loss) · 🟠 High (exploitable with modest effort, real impact) · 🟡 Medium (needs specific conditions, or lower impact) · 🟢 Low (hardening, defense-in-depth).

---

## 1. Authentication & Session Management

- 🔴 **Passwords stored in plaintext or with weak hashing.** Check: search the schema/model for a `password` column and see how it's written. Fix: use a vetted auth provider (Supabase Auth, Firebase Auth, Auth.js/NextAuth, Clerk, Auth0) or, if rolling your own, bcrypt/argon2 with a proper cost factor — never MD5/SHA1/plain.
- 🔴 **No session expiry / tokens that never expire.** Check: JWT config or session cookie settings. Fix: set reasonable expiry (hours-days, not years) and implement refresh tokens rather than long-lived access tokens.
- 🟠 **Session tokens in localStorage instead of httpOnly cookies.** Check: where the auth token is stored client-side. Risk: readable by any injected script (XSS becomes account takeover). Fix: httpOnly, Secure, SameSite cookies where the framework supports it.
- 🟠 **No account lockout / rate limit on login.** Check: hit the login endpoint repeatedly. Fix: rate limit by IP and by account, add exponential backoff or CAPTCHA after repeated failures.
- 🟡 **Password reset tokens that are guessable, long-lived, or not single-use.** Check: how reset tokens are generated and whether they're invalidated after use. Fix: cryptographically random tokens, short expiry (15-60 min), invalidate on use.
- 🟡 **No email verification, allowing account creation with someone else's email.** Relevant when email is used for anything sensitive (password reset, notifications about someone's data).

## 2. Authorization / Access Control

This is the category vibecoded apps fail most often — "is the user logged in" gets built, "is this *their* data" doesn't.

- 🔴 **Insecure Direct Object Reference (IDOR).** Check: does `/api/orders/123` (or any resource-by-ID endpoint) verify the logged-in user owns order 123, or does it just check they're logged in at all and return whatever ID is requested? Test by changing the ID in a request to one that isn't yours. Fix: every query for a specific record must filter by the requesting user's ownership/permission, not just existence of a valid session.
- 🔴 **Missing row-level security on the database itself.** Especially relevant for Supabase/Postgres and Firebase — see `stack-notes.md`. Even if the app's API layer checks ownership, if the database/table is also reachable directly (common with BaaS client SDKs), the database rules are the *real* enforcement point, not the frontend code.
- 🔴 **Admin/internal routes reachable without an admin check.** Check: is there a `/admin` or similar route, and does it independently verify an admin role, or does it just check "logged in"? Fix: explicit role check server-side on every admin route and admin API endpoint.
- 🟠 **Client-side-only authorization (hiding a button ≠ blocking the action).** Check: if a feature is hidden in the UI for non-admins, is the underlying API endpoint also protected? Fix: every privileged action must be enforced server-side; UI hiding is UX polish only.
- 🟡 **Mass assignment — API accepts fields it shouldn't (e.g. a signup endpoint that accepts `role: "admin"` in the request body).** Fix: explicitly allow-list writable fields per endpoint rather than passing the whole request body through to the database.

## 3. Input Validation & Injection

- 🔴 **SQL injection via string-concatenated queries.** Check: search for raw SQL built with string concatenation or template literals instead of parameterized queries/an ORM. Fix: always use parameterized queries or ORM query builders (Prisma, Drizzle, Supabase client, etc.) — never interpolate user input directly into SQL strings.
- 🔴 **Command injection** if the app ever shells out (`exec`, `child_process`, etc.) with any user-influenced input. Fix: avoid shelling out with user input entirely if possible; if unavoidable, use strict allow-lists and never pass raw user input to a shell.
- 🟠 **Stored/reflected XSS** — user input rendered back into HTML without escaping, or `dangerouslySetInnerHTML`/`innerHTML` used with user-controlled content. Fix: rely on framework auto-escaping (React/Vue do this by default for normal rendering); avoid raw HTML injection of user content; if rich text is required, sanitize with a vetted library (DOMPurify) server- and client-side.
- 🟡 **No server-side validation, only client-side.** Check: can the API be called directly (curl/Postman) with invalid or malicious data and have it accepted? Fix: validate every input server-side (type, length, format, range) regardless of what the client does — treat client validation as UX only.
- 🟡 **Unrestricted file type / size on any input that becomes a filename, path, or is later executed/parsed.** See File Uploads section below.
- 🟢 **Missing output encoding for non-HTML contexts** (e.g. user input inserted into a URL, a CSV export formula field — CSV injection, or a log line used for log injection).

## 4. Secrets & Configuration

- 🔴 **API keys or secrets hardcoded in source or committed to git.** Check: grep the codebase and git history for key-shaped strings (`sk_`, `AIza`, `AKIA`, long base64/hex tokens near words like `key`/`secret`/`token`). Fix: move to environment variables, rotate any key that was ever committed (removing it from a future commit does not un-expose a key already pushed — treat it as burned).
- 🔴 **Secret/privileged key shipped to the browser.** Check: any `NEXT_PUBLIC_`-prefixed (or equivalent) env var, or any key referenced in client-side code, that is a service-role/admin/secret key rather than a publishable/anon key. This is one of the single most common and most severe vibecoded-app bugs — a service-role key in the frontend bundle gives any visitor full database access regardless of RLS. Fix: only ever expose publishable/anon/public keys client-side; privileged keys stay server-side only (API routes, server actions, edge functions), never referenced in any file that ends up in the client bundle.
- 🟠 **`.env` file committed to the repository.** Check: `.gitignore` includes `.env*`, and check git history for whether it was ever committed even if it's ignored now. Fix: add to `.gitignore`, remove from history if already committed, rotate every secret that was exposed.
- 🟡 **Same secrets/keys used across dev, staging, and production.** Fix: separate credentials per environment so a leak in one doesn't compromise all.
- 🟡 **Verbose config or debug info exposed via an endpoint** (e.g. a `/debug` or `/status` route dumping environment variables or internal config).

## 5. API Security

- 🟠 **No rate limiting on expensive or abusable endpoints** — anything that calls a paid third-party API (especially AI/LLM APIs), sends email/SMS, or does heavy computation. Check: can the endpoint be called in a tight loop with no pushback? Fix: rate limit per-IP and/or per-account; consider a cost cap for anything billed per call.
- 🟠 **CORS configured with a wildcard (`*`) alongside credentials, or wildcard on an API that shouldn't be publicly callable from any origin.** Fix: allow-list specific origins that legitimately need access.
- 🟡 **No request size limits**, allowing large-payload DoS.
- 🟡 **Verbose error messages leaking stack traces, internal file paths, or query details to the client.** Fix: generic error messages to the client, detailed errors to server-side logs only.
- 🟡 **GraphQL-specific: introspection enabled in production, or no query depth/complexity limiting** (if the app uses GraphQL).
- 🟢 **No API versioning or deprecation plan** — not a security bug per se, but makes future security patches harder to roll out safely.

## 6. Data Storage & Privacy

- 🔴 **Sensitive data (passwords already covered above; also: SSNs, full card numbers, health data) stored unencrypted where encryption is expected or required by regulation.** Fix: encrypt at rest for genuinely sensitive fields; better yet, don't store what you don't need to (e.g. never store raw card numbers — use a payment processor, see Payments section).
- 🟠 **Publicly readable cloud storage buckets** (S3, Supabase Storage, Firebase Storage) containing user files, especially ones with predictable/sequential names. Check: try accessing a file URL without auth. Fix: private buckets by default with signed/expiring URLs, or explicit access rules matching the app's authorization model.
- 🟡 **Database backups or exports left publicly accessible.**
- 🟡 **Excessive data collection / no data retention policy** — collecting more PII than the feature needs increases breach impact for no benefit.
- 🟢 **No mechanism for users to export or delete their data**, relevant if the app has any users in a jurisdiction with data-rights regulation (GDPR/CCPA-type obligations) — flag this as a product/legal question, not something to silently implement without the user's sign-off.

## 7. File Uploads

- 🔴 **No validation of uploaded file type/content, with the file served back or executed.** Check: does the app trust the client-reported MIME type / file extension? Fix: validate actual file content (magic bytes), not just extension; never allow uploaded files to be executed server-side.
- 🟠 **Uploaded files served from the same origin/domain as the app**, enabling stored XSS via an uploaded HTML/SVG file. Fix: serve user uploads from a separate domain/subdomain with no cookies, or force download instead of inline rendering for non-image types.
- 🟡 **No file size limit**, enabling storage exhaustion / DoS.
- 🟡 **Predictable upload paths/filenames** allowing enumeration of other users' files.

## 8. Third-Party Dependencies & Supply Chain

- 🟠 **Known-vulnerable dependencies.** Check: run `npm audit` / `pip-audit` / the ecosystem equivalent. Fix: update, or if a fix isn't available, evaluate whether the vulnerable code path is actually reachable and mitigate.
- 🟡 **Dependencies pulled from unofficial/unverified sources**, or install scripts run without review.
- 🟢 **No dependency update process** — not urgent per-item, but flag if the project has no plan to ever revisit this.

## 9. Client-Side Exposure

- 🔴 **Sensitive business logic or validation that exists only client-side** (e.g. price calculated in the browser and trusted by the server on checkout). Fix: server must be the source of truth for anything with financial or security consequence — recompute/re-validate server-side even if the client also does it.
- 🟠 **Source maps or verbose client bundles exposing internal API structure, comments with sensitive context, or unminified code with internal notes** in production builds.
- 🟡 **Feature flags or unreleased features shipped in the client bundle but "hidden" by the UI**, discoverable by anyone reading the JS.

## 10. Deployment & Infrastructure

- 🟠 **No HTTPS / mixed content.** Fix: enforce HTTPS everywhere, redirect HTTP to HTTPS, HSTS header.
- 🟡 **Missing security headers**: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. Check with a header-scanning tool or manually.
- 🟡 **Debug/dev mode enabled in production** (framework debug flags that expose stack traces, admin toolbars, or hot-reload endpoints).
- 🟡 **No monitoring/alerting for auth failures, error spikes, or unusual traffic**, meaning an active attack could go unnoticed.
- 🟢 **Default credentials left unchanged** on any admin panel, database, or infra dashboard.

## 11. Payments & Financial Data

- 🔴 **Ever touching raw card numbers server-side instead of tokenizing through a processor.** Fix: use Stripe/Braintree/etc. Elements or hosted fields so raw card data never hits your server (PCI scope reduction) — this is close to a hard rule, not a judgment call.
- 🔴 **Trusting a client-supplied price/amount at checkout** (see Client-Side Exposure above) — always recompute the charge amount server-side from trusted data (the actual cart/product records), never from a value passed in the request.
- 🟠 **Webhook endpoints (Stripe etc.) that don't verify the signature**, allowing anyone to POST fake payment-succeeded events. Fix: verify webhook signatures using the provider's SDK before trusting the payload.

## 12. Logging & Monitoring

- 🟡 **Logging sensitive data** (passwords, full tokens, card numbers, PII) in plaintext logs. Fix: redact/mask before logging.
- 🟡 **No logging at all for security-relevant events** (login failures, permission denials, admin actions) — makes incident response impossible after the fact.
- 🟢 **Logs not access-controlled**, or shipped to a third-party logging service without review of what's being sent.
