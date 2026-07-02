# Stack-Specific Notes

Read the section matching the user's stack. These are the failure modes that show up over and over in vibecoded apps on each platform, beyond the general checklist.

---

## Supabase

Supabase's client SDK is designed to be called directly from the browser, which means **Postgres Row-Level Security (RLS) is the real authorization boundary** — not your API routes, not your frontend code. This is the single most common vibecoded-Supabase vulnerability: a table with RLS disabled (or a policy that's too permissive) is directly readable/writable by anyone with the anon key, which is public by design.

- 🔴 **RLS disabled on any table containing user or sensitive data.** Check: in the Supabase dashboard, Table Editor → each table → confirm "RLS enabled." Or query `pg_tables`/`pg_policies`. A table with RLS *off* is fully open to anyone with the anon key once it's disabled — anon key exposure is expected and fine, RLS being off is not.
- 🔴 **RLS enabled but with a policy that's effectively `USING (true)`** for write operations — this "enables" RLS in name but doesn't restrict anything. Check every policy actually filters by `auth.uid()` or an equivalent ownership/role check, per operation (select/insert/update/delete each need their own policy).
- 🔴 **Service-role key referenced anywhere in client code / shipped in the bundle.** The service role key bypasses RLS entirely. It must only be used in server-side contexts (Edge Functions, a backend server, server actions) — never in any file that gets bundled for the browser.
- 🟠 **Storage buckets set to public when they contain user-specific files.** Check bucket policies the same way as table RLS — public buckets skip auth entirely.
- 🟠 **Database functions (RPC) marked `SECURITY DEFINER` without careful review** — these run with the function owner's privileges, potentially bypassing RLS if not written carefully.
- 🟡 **Realtime subscriptions on tables without RLS**, leaking row changes to anyone subscribed.

## Firebase / Firestore

- 🔴 **Firestore/Realtime Database security rules left in test-mode default** (`allow read, write: if true;`) past the prototype stage — this is the RLS-off equivalent for Firebase and is astonishingly common because "test mode" is the default when creating a new project.
- 🔴 **Security rules checking `request.auth != null` only, without validating the requesting user actually owns the resource** — same IDOR problem as elsewhere, just expressed in rules syntax (`request.auth.uid == resource.data.ownerId` is the pattern to look for).
- 🟠 **Firebase Storage rules similarly left open**, or granting access based only on authentication rather than ownership.
- 🟡 **Cloud Functions callable without auth checks**, especially ones doing privileged operations (using the Admin SDK, which bypasses security rules entirely — same risk class as a Supabase service-role key).
- 🟢 **API key restrictions not configured in Google Cloud Console** — Firebase API keys are not secret by design, but should still be restricted to specific APIs/referrers to reduce abuse surface.

## Next.js / Node / Express (custom backend)

- 🟠 **API routes / server actions with no auth middleware**, relying on the frontend to "not call" a protected route rather than enforcing it server-side. Every API route must independently check auth, not inherit it from page-level protection.
- 🟠 **Environment variables prefixed for client exposure (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, etc.) used for anything that isn't meant to be public.** These prefixes are a signal to the bundler "ship this to the browser" — treat any secret/privileged key that accidentally gets this prefix as fully public and compromised.
- 🟠 **Server actions (Next.js) that skip validation because "it's not a public API"** — server actions are still callable directly with a crafted request; they need the same validation and auth checks as a REST endpoint.
- 🟡 **Middleware-based auth that doesn't actually run on all intended routes** due to matcher config mistakes — check the middleware `matcher` config actually covers every route it's supposed to protect.
- 🟡 **`getServerSideProps`/route handlers passing raw database records to the client**, including fields (internal IDs, other users' data, hashed passwords) that were only fetched for server-side logic and were never meant to be serialized to the page.

## Static sites + serverless functions (Vercel/Netlify functions, Cloudflare Workers)

- 🟠 **Environment variables/secrets set at the platform level but still referenced in a client-bundled file** by mistake — same risk as above, just easier to get wrong because secrets and public config often live in the same `.env`.
- 🟡 **Serverless functions with no rate limiting**, which is both a security and a cost-control issue (an attacker can run up the bill as easily as they can abuse the endpoint).
- 🟡 **CORS defaults left wide open** on functions meant to be called only from the site's own frontend.

## No-code / low-code (Bubble, Webflow + Zapier/Make, Glide, Softr, etc.)

- 🔴 **Data privacy rules not configured** — most no-code platforms default to "logged-in users can see all data" or similar broad defaults until privacy rules are explicitly set per data type. This is the RLS-off equivalent for no-code tools; check every table/collection's privacy/visibility settings individually.
- 🟠 **API keys for connected third-party services (Zapier, Stripe, email providers) stored in a way visible to app editors/collaborators who shouldn't have them**, or exposed via a workflow that echoes them back in a response.
- 🟠 **Webhook URLs used as the only auth mechanism** (whoever has the URL can trigger the automation) — add a shared-secret check or signature verification if the platform supports it.
- 🟡 **Public API endpoints auto-generated by the platform left enabled** when the feature isn't actually in use, expanding attack surface for no benefit.

Since Claude/AI agents often can't directly inspect a no-code platform's internal config, when reviewing a no-code app: ask the user to walk through (or screenshot) the data privacy/permission settings for each collection/table rather than assuming from the visible workflow logic alone.
