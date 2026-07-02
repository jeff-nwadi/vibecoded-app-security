# Prompt Library: Security for Vibecoded Apps

Copy-paste these into Claude, or any other AI coding assistant. They're written to be self-contained — each one states the goal, the standard to check against, and the output format, so the AI doesn't have to guess what "good" looks like.

---

## 1. Full pre-launch security audit

```
Do a full security audit of this codebase before I launch it. Go category by
category: authentication & sessions, authorization/access control (especially
IDOR — check that every resource-by-ID endpoint verifies ownership, not just
login status), input validation & injection, secrets & config (check for any
hardcoded keys or privileged keys exposed to the client), API security (rate
limiting, CORS), data storage & privacy, file uploads, dependency
vulnerabilities, and deployment/headers.

For each issue found, tell me: the severity (critical/high/medium/low), where
it is, why it's exploitable, and exactly how to fix it. Order the findings by
how bad it would be if exploited, not by how easy they were to find. Be blunt
about severity — don't soften a critical finding to be polite. End with a
one-paragraph summary of whether this is safe to launch as-is.
```

## 2. Check for the #1 vibecoded-app mistake: exposed privileged keys

```
Search this entire codebase (including any files that get bundled for the
browser) for any API key, secret, or credential that shouldn't be visible to
end users — service-role keys, admin SDK credentials, private API keys, etc.
Specifically check: every environment variable that's prefixed for client
exposure (NEXT_PUBLIC_, VITE_, REACT_APP_, etc.) — is it actually meant to be
public? Any hardcoded strings that look like keys? Any privileged key
referenced in a file that isn't clearly server-only?

List every finding with the file and line, explain what that key can do if
someone extracts it from the browser bundle, and tell me how to move it
server-side. Assume any key you find exposed has already been compromised
and needs rotating.
```

## 3. Row-level security / data access review (Supabase/Postgres, Firebase, or similar)

```
Review the authorization model for [Supabase RLS policies / Firestore
security rules / my database access rules] on every table/collection that
holds user or sensitive data. For each one, tell me:
1. Is access control enabled at all, or is it open by default?
2. Does the read/write rule check actual ownership (the record belongs to
   the requesting user) or just "is logged in"?
3. Are insert/update/delete each independently restricted, or does enabling
   one accidentally leave another open?

Flag anything that would let a logged-in user read or modify another user's
data, and give me the exact rule/policy fix for each.
```

## 4. Harden a specific feature before shipping it

```
I'm about to ship [feature — e.g. "the file upload for user avatars" /
"the checkout flow" / "the admin dashboard"]. Review it against these
questions and fix anything that fails:
- Is every input validated server-side, not just in the UI?
- If this touches money, is the amount/price recomputed server-side from
  trusted data, never trusted from the client?
- If this is an admin-only feature, is there a server-side role check on
  every route/action involved, not just a hidden UI element?
- If this accepts files, is the actual file content validated (not just
  the extension), and are uploads served in a way that can't become stored
  XSS?
- Is there rate limiting if this is abusable or costs money per call?

Show me the fixed code, and briefly explain what was missing.
```

## 5. Quick "is this safe to launch" gut check (fast, lower depth)

```
I'm about to launch [app description] to real users. Before I do, do a fast
pass focused only on the things that would be actively dangerous if
skipped: exposed secrets/API keys, any place a user could access another
user's data (IDOR), missing auth on admin or privileged routes, and SQL
injection risk. Skip hardening/nice-to-have items for now — I just need to
know if there's anything that would let someone break in or steal data on
day one.
```

## 6. New feature, build security in from the start

```
Build [feature]. As you build it, apply these defaults without me having to
ask: validate all input server-side, check both authentication AND
ownership/authorization for any data-specific action, never expose
privileged keys or secrets to the client, use parameterized
queries/ORM methods (never raw string-built SQL), and add rate limiting if
this is abusable or calls a paid API. Briefly tell me what security measures
you included so I know what's already handled.
```

## 7. Dependency / supply-chain check

```
Check this project's dependencies for known vulnerabilities (run the
ecosystem's audit tool — npm audit, pip-audit, etc. — or check manually if
that's not available). For anything flagged, tell me whether the vulnerable
code path is actually reachable in how this app uses the package, and
whether it's safe to just update or if it needs a workaround.
```

## 8. Explain a finding to a non-security person

```
Explain [specific vulnerability, e.g. "IDOR" / "why my anon key can't have
admin access" / "why RLS matters"] to me like I'm a beginner who vibecoded
this app and doesn't have a security background. Use a concrete example of
how someone would actually exploit it on my app specifically, not a generic
definition, so I understand why it matters and remember to check for it next
time.
```

---

## Tips for using these well

- **Point the AI at the actual code, not just a description of it.** "Review my auth" gets a generic answer; "review the code in `/api/auth` and `/lib/session.ts`" gets a real one.
- **Ask for severity and exploitability, every time.** A flat list of "issues" without prioritization is hard to act on — you want to know what to fix today versus what can wait.
- **Re-run the audit after fixes, don't just trust the fix summary.** AI-applied fixes can be incomplete or introduce new issues; a second pass is cheap insurance.
- **For anything handling real payment or health data, treat this as a floor, not a ceiling.** These prompts catch common code-level issues; regulated data usually needs a professional audit too (PCI-DSS, HIPAA, SOC 2, etc. as applicable) — don't let a clean AI review substitute for that when it's actually required.
