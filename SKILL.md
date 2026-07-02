---
name: vibecoded-app-security
description: Security requirements and review process for "vibecoded" web apps and websites — apps built quickly with AI coding assistance (Claude, Cursor, Lovable, Bolt, v0, Replit, etc.), often skipping traditional security review. Use this whenever the user is building, extending, reviewing, or preparing to launch/deploy a website or web app, especially when they mention login/auth, forms, file uploads, payments, APIs, a database, user accounts, admin panels, or connecting to Supabase/Firebase/other BaaS providers. Also use whenever the user explicitly asks for a security review, security audit, security checklist, "is this safe to launch," pre-launch review, penetration test prep, or wants ready-made prompts for building or checking security into a vibecoded project. Trigger even if the user doesn't say the word "security" but describes shipping something with real users, real data, or payments.
---

# Vibecoded App Security

## Why this skill exists

Apps built through fast, AI-assisted "vibecoding" get shipped without the review step a traditional engineering team would normally have. The person is usually optimizing for speed and features, and the AI generating the code is usually optimizing for "it works," not "it's safe." The result is a predictable, repeating set of holes: API keys embedded in client bundles, database tables with no row-level security, admin routes with no auth check, wide-open CORS, and verbose error messages that hand an attacker your stack trace. None of these are exotic — they're the boring, common ones, which is exactly why a systematic pass catches them and ad-hoc vibes don't.

This skill has two jobs, and most requests need both:
1. **Build it in** — when generating or extending app code, apply the relevant checklist items proactively so the vulnerability never ships in the first place.
2. **Catch it after the fact** — when asked to review, audit, or "is this safe" existing code, systematically walk the checklist and produce a prioritized findings report.

## Step 0: figure out which mode applies

- **Build mode**: the user is asking for a new feature, page, API route, form, auth flow, upload handler, database schema, or similar. Apply the relevant checklist items from `references/checklist.md` as you write the code — don't wait to be asked. Mention briefly in your response what security measures you included (e.g., "added rate limiting and server-side validation on this endpoint since it accepts user input").
- **Audit mode**: the user has existing code and wants it reviewed, or wants to know if it's safe to launch. Run the full process below.
- **Both**: very common — e.g. "review my signup flow and fix any issues" is audit + build in the same turn.
- **Prompt-library mode**: the user just wants copy-paste prompts to use elsewhere (a different AI tool, a teammate, etc.) rather than a live review. Go straight to `assets/prompts.md` and hand over the relevant prompts — no need to read code yourself.

If genuinely unclear which mode fits (rare — most requests make it obvious from context), ask one question rather than guessing.

## Audit mode: process

1. **Identify the stack.** Look at the codebase (package.json, config files, folder structure) or ask if not visible. This determines which parts of `references/stack-notes.md` apply — a Supabase app and a plain Express app fail in different places.
2. **Run the quick scanner first.** `scripts/quick-scan.js` greps for the highest-signal, cheapest-to-catch issues (hardcoded secrets, service-role keys in client code, wildcard CORS, committed `.env` files, disabled RLS, etc.). It's plain Node.js with no dependencies, so it runs anywhere Node runs. Run it before manual review — it's fast and catches the things that are easy to miss by eye, and its output tells you where to focus your manual read.
   ```bash
   node scripts/quick-scan.js <path-to-project>
   ```
3. **Work through the checklist manually.** Read `references/checklist.md` and go category by category: auth & sessions, authorization/access control, input validation & injection, secrets & config, API security, data storage & privacy, file uploads, dependencies, client-side exposure, deployment & headers, payments, logging. Not every category applies to every app — skip what's genuinely not present (no file upload feature means skip that section) but don't skip a category just because checking it is tedious.
4. **Check stack-specific gotchas.** Read the relevant section of `references/stack-notes.md`. Row-level security misconfigurations (Supabase/Postgres) and open Firestore/Storage rules are the single most common vibecoded-app vulnerability in practice — check these first if the stack uses a BaaS.
5. **Produce a findings report** using the format below. Don't just list problems — for each one give a concrete fix, and where useful, a prompt the user could hand to their AI coding tool to fix it (pull from `assets/prompts.md` or write a new one in the same style).

### Findings report format

```markdown
# Security Review — <project/feature name>

## Summary
<1-3 sentences: overall risk level and the single most urgent thing to fix>

## Findings

### 🔴 Critical
- **[Category] Short title** — what's wrong, where (file/line if known), why it's exploitable, and the fix.

### 🟠 High
...

### 🟡 Medium
...

### 🟢 Low / Hardening
...

## Not applicable / not checked
<be explicit about what you didn't review, e.g. "no access to production infra config, couldn't verify HTTPS/header setup">
```

Order findings by exploitability and blast radius, not by how easy they were to find. A single exposed service-role key outranks ten missing security headers.

## Build mode: how to apply it

When writing new code, treat the checklist as defaults, not an opt-in extra:
- Server-side validation on anything client input touches, even if there's client-side validation too (client-side is UX, not security).
- Auth + authorization checks on every API route/server action that touches user-specific or non-public data — check both "is this user logged in" and "is this user allowed to touch *this* record," since the second one is the check vibecoded apps most often skip.
- Never put a service-role key, admin SDK credential, or any secret with elevated privileges anywhere that ships to the browser. If in doubt about whether a key is safe client-side, treat it as not safe and move the call server-side.
- Parameterized queries / ORM methods, never raw string-concatenated SQL.
- Rate limiting on anything that costs money per call (AI API wrappers especially) or that's a plausible brute-force target (login, OTP, password reset).
- Least-privilege defaults on new database tables/storage buckets — deny by default, then open up exactly what's needed, rather than starting open and locking down later (which vibecoded projects reliably forget to do).

Don't silently over-engineer a prototype the user explicitly called a throwaway experiment — but do flag out loud when you're skipping something because of that, so it's a visible decision rather than a silent gap: "this is a quick prototype so I skipped rate limiting, but add it before this handles real users."

## Reference files

- `references/checklist.md` — the full category-by-category security checklist with why-it-matters, how-to-check, and how-to-fix for each item. This is the core reference; read it whenever doing a real audit or building anything that touches auth, data, or money.
- `references/stack-notes.md` — gotchas specific to common vibecoding stacks: Supabase, Firebase, Next.js/Node/Express, static sites + serverless functions, and no-code/low-code builders. Read the section matching the user's stack.
- `assets/prompts.md` — a library of ready-to-use prompts for security review, hardening, and pre-launch checks, meant to be copy-pasted by the user into any AI coding tool (including this one). Hand these over directly when the user wants prompts rather than a live review.
- `scripts/quick-scan.js` — a lightweight, dependency-free Node.js scanner for the highest-signal, easy-to-automate issues (secrets, wildcard CORS, exposed `.env`, disabled RLS markers, etc). Also the `npx vibecoded-app-security` CLI entry point. Not a substitute for the manual checklist pass — a fast first pass that tells you where to look harder.

## A note on scope and honesty

This skill covers the common, well-understood vulnerability classes that repeatedly show up in fast AI-assisted builds. It is not a substitute for a professional penetration test or a compliance audit (SOC 2, PCI-DSS, HIPAA, etc.) if the app handles regulated data or the user needs that certification — say so plainly when it's relevant, rather than implying a chat-based review covers that bar. Be direct about severity: don't soften a critical finding to be polite, and don't call something "done" or "secure" after a review — say what was checked and what wasn't.
