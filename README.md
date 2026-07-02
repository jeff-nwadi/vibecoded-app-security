# vibecoded-app-security

A [Claude Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) — and standalone reference — for securing web apps and websites built quickly with AI coding assistance ("vibecoding"): Claude, Cursor, Lovable, Bolt, v0, Replit, and similar tools.

Vibecoded apps tend to fail security in the same handful of predictable, boring ways: API keys shipped to the browser, database tables with no row-level security, admin routes with no auth check, wildcard CORS, and verbose error messages. This skill catches those systematically, both while building (bake security in from the start) and after the fact (structured audit with a prioritized report).

## What's in here

```
vibecoded-app-security/
├── SKILL.md                    # Entry point — when/how this skill triggers and the review process
├── install.sh                  # One-line installer into ~/.claude/skills or .claude/skills
├── package.json                # Makes scripts/quick-scan.js runnable via `npx`
├── references/
│   ├── checklist.md            # Full OWASP-aligned checklist, 12 categories, severity + fix per item
│   └── stack-notes.md          # Gotchas specific to Supabase, Firebase, Next.js/Node, no-code tools
├── assets/
│   └── prompts.md               # Copy-paste prompt library for security review & hardening
└── scripts/
    └── quick-scan.js             # Dependency-free Node.js scanner (also the `npx` / CLI entry point)
```


## Quick install

**Run the scanner instantly**
```bash
npx github:jeff-nwadi/vibecoded-app-security /path/to/your/project
npx github:jeff-nwadi/vibecoded-app-security /path/to/your/project --json
```
If you publish it to the npm registry later (`npm publish` from this folder), it also works as:
```bash
npx vibecoded-app-security /path/to/your/project
```

**Install the Claude Skill itself**, one line:
```bash
curl -fsSL https://raw.githubusercontent.com/jeff-nwadi/vibecoded-app-security/main/install.sh | bash
```
This clones the skill into `~/.claude/skills/vibecoded-app-security`, where Claude Code picks it up automatically. Options:
```bash
./install.sh --project        # install into ./.claude/skills instead (commit it, shared with your team)
./install.sh --dir <path>     # install into a custom directory
```

## Using it with Claude

**Claude.ai / Claude apps:** upload this folder (or the packaged `.skill` file) as a Skill in Settings → Capabilities → Skills. claude.ai doesn't read your local filesystem, so `install.sh` doesn't apply here — zip and upload instead. Once enabled, Claude pulls this in automatically whenever you're building, reviewing, or shipping a web app — you don't need to reference it by name.

**Claude Code:** use `install.sh` above, or manually:
```bash
git clone https://github.com/jeff-nwadi/vibecoded-app-security.git ~/.claude/skills/vibecoded-app-security
```
Personal skills go in `~/.claude/skills/`, project skills (shared via git with your team) go in `.claude/skills/` inside the repo.

**Any other AI coding tool:** you don't need the skill mechanism at all — just open `references/checklist.md` and `assets/prompts.md` and copy what you need. The prompts are written to be self-contained and work with any AI assistant.

## Using the scanner standalone

No Claude, no Python, no install required — just Node.js (built into most dev environments already):

```bash
npx github:jeff-nwadi/vibecoded-app-security /path/to/your/project
node scripts/quick-scan.js /path/to/your/project --json   # or, from a local clone
```

It catches hardcoded API keys, privileged keys exposed to client code, wildcard CORS, committed `.env` files, disabled RLS/security-rule markers, raw SQL string concatenation, and a few other high-signal patterns. It's a fast first pass, **not** a substitute for the manual checklist — it won't catch logic issues like missing authorization checks (IDOR), which is the most common real vulnerability class in vibecoded apps and needs a human (or Claude) to actually read the code.

## What it checks

12 categories, each with severity ratings and concrete fixes — see `references/checklist.md` for the full detail:

1. Authentication & Session Management
2. Authorization / Access Control (IDOR, missing ownership checks)
3. Input Validation & Injection (SQLi, XSS, command injection)
4. Secrets & Configuration (exposed/hardcoded keys — the #1 vibecoded-app bug)
5. API Security (rate limiting, CORS)
6. Data Storage & Privacy
7. File Uploads
8. Third-Party Dependencies & Supply Chain
9. Client-Side Exposure
10. Deployment & Infrastructure
11. Payments & Financial Data
12. Logging & Monitoring

Plus stack-specific notes for **Supabase**, **Firebase**, **Next.js/Node/Express**, **static + serverless**, and **no-code/low-code** platforms — the row-level-security / security-rules misconfiguration is called out specifically since it's the single most common serious vibecoded-app vulnerability in practice.

## Scope and honesty

This covers the common, well-understood vulnerability classes that repeatedly show up in fast AI-assisted builds. It is **not** a substitute for a professional penetration test or a compliance audit (SOC 2, PCI-DSS, HIPAA, etc.) if your app handles regulated data. Treat it as a solid floor, not a ceiling.

## Contributing

Found a vulnerability pattern that keeps showing up in vibecoded apps and isn't covered here? Open a PR against `references/checklist.md` or `references/stack-notes.md`, or add a rule to `scripts/quick-scan.js`.

## License

 use it, fork it, ship it.