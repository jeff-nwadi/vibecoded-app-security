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

Unable to get absolute uri between \README.md and ; Base path '' must be an absolute path