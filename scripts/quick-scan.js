#!/usr/bin/env node
/**
 * quick-scan.js — fast, dependency-free first pass for the highest-signal,
 * easiest-to-automate issues in a vibecoded web app.
 *
 * This is NOT a substitute for the manual checklist review in
 * references/checklist.md. It's a cheap first pass that surfaces obvious,
 * grep-able problems (hardcoded secrets, exposed privileged keys, wildcard
 * CORS, committed .env files, disabled RLS markers, raw SQL concatenation)
 * so you know where to focus the manual read. Zero npm dependencies —
 * Node.js built-ins only — so `npx` can run it without installing anything.
 *
 * Usage:
 *   npx vibecoded-app-security <path-to-project>
 *   npx vibecoded-app-security <path-to-project> --json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'out',
  'venv', '.venv', '__pycache__', '.turbo', 'coverage',
  '.vercel', '.netlify', 'target',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.php', '.go', '.java', '.kt',
  '.html', '.vue', '.svelte', '.yaml', '.yml', '.json', '.toml',
]);

const ENV_FILENAMES = new Set(['.env', '.env.local', '.env.production', '.env.development']);

// Each rule: { id, severity, description, pattern, note }
const RULES = [
  {
    id: 'hardcoded-key-pattern',
    severity: 'critical',
    description: 'String matching a known API-key format hardcoded in source',
    pattern: /(sk_live_[A-Za-z0-9]{10,}|sk_test_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z\-_]{30,}|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{30,}|eyJhbGciOi[A-Za-z0-9_\-.]{20,})/,
    note: 'Rotate this key immediately if it was ever committed to git, then move it to an env var loaded server-side only.',
  },
  {
    id: 'supabase-service-role-in-client',
    severity: 'critical',
    description: 'Reference to a Supabase service-role key near client-bundled code',
    pattern: /SUPABASE_SERVICE_ROLE|service_role.{0,40}key/i,
    note: 'Service-role keys bypass Row-Level Security entirely. Confirm this file is server-only and never bundled for the browser.',
  },
  {
    id: 'public-env-var-suspicious-name',
    severity: 'high',
    description: "Client-exposed env var (NEXT_PUBLIC_/VITE_/REACT_APP_ prefix) with a name suggesting it's a secret",
    pattern: /(NEXT_PUBLIC_|VITE_|REACT_APP_)\w*(SECRET|SERVICE_ROLE|PRIVATE_KEY|ADMIN)\w*/i,
    note: "This prefix ships the variable to the browser. If it's actually a secret/privileged key, rename and move it server-side.",
  },
  {
    id: 'wildcard-cors',
    severity: 'high',
    description: 'CORS allow-origin wildcard',
    pattern: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/,
    note: "Wildcard CORS on an API that isn't meant to be publicly callable from any origin. Allow-list specific origins instead.",
  },
  {
    id: 'raw-sql-concatenation',
    severity: 'high',
    description: 'Possible raw SQL built with string concatenation/interpolation',
    pattern: /(?=.*\b(SELECT|INSERT|UPDATE|DELETE)\b)(?=.*\b(FROM|INTO|WHERE|SET)\b)(?=.*(\+\s*\w+|\$\{|%s\s*%|f["']))/i,
    note: "Confirm this isn't user input reaching the query unparameterized. Use parameterized queries or an ORM/query builder instead.",
  },
  {
    id: 'dangerous-html-injection',
    severity: 'medium',
    description: 'dangerouslySetInnerHTML / innerHTML usage',
    pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/,
    note: "Confirm the content isn't user-controlled, or sanitize with a vetted library (e.g. DOMPurify) before rendering.",
  },
  {
    id: 'disabled-rls-comment-or-flag',
    severity: 'critical',
    description: 'Text suggesting Row-Level Security or security rules are disabled/permissive',
    pattern: /(rls\s*disable|row.level.security.{0,20}(off|disable|false)|allow\s+read,\s*write:\s*if\s+true|USING\s*\(\s*true\s*\))/i,
    note: 'Verify: is this table/collection meant to be fully public, or is this a leftover from prototyping? Test-mode defaults on Firebase and disabled RLS on Supabase are the most common vibecoded-app data leak.',
  },
  {
    id: 'console-log-of-secret-like-var',
    severity: 'low',
    description: "Logging a variable whose name suggests it holds a secret/token/password",
    pattern: /console\.(log|debug|info)\([^)]*(token|secret|password|apikey|api_key)[^)]*\)/i,
    note: 'Avoid logging secrets, even in development — logs often end up somewhere less controlled than expected.',
  },
];

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function walk(root, onFile) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.')) continue;
      walk(full, onFile);
    } else if (entry.isFile()) {
      onFile(full);
    }
  }
}

function checkEnvFiles(root) {
  const findings = [];
  const gitignorePath = path.join(root, '.gitignore');
  let ignoredPatterns = '';
  if (fs.existsSync(gitignorePath)) {
    ignoredPatterns = fs.readFileSync(gitignorePath, 'utf8');
  }

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        scanDir(full);
      } else if (ENV_FILENAMES.has(entry.name)) {
        const rel = path.relative(root, full);
        const covered = ignoredPatterns.includes('.env');
        findings.push({
          rule: 'env-file-present',
          severity: covered ? 'low' : 'high',
          file: rel,
          line: null,
          match: entry.name,
          note: covered
            ? 'An .env file exists; .gitignore appears to cover .env files. Still worth double-checking git history in case it was committed before the ignore rule was added.'
            : 'An .env file exists and .gitignore does not appear to cover it — verify it was never committed and add a .env* rule to .gitignore.',
        });
      }
    }
  }

  scanDir(root);
  return findings;
}

function scanFile(filePath, root) {
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return findings;
  }
  const lines = content.split('\n');

  for (const rule of RULES) {
    lines.forEach((line, idx) => {
      if (rule.pattern.test(line)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          description: rule.description,
          file: path.relative(root, filePath),
          line: idx + 1,
          match: line.trim().slice(0, 160),
          note: rule.note,
        });
      }
    });
  }
  return findings;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const targetArg = args.find((a) => a !== '--json');

  if (!targetArg) {
    console.error('Usage: npx vibecoded-app-security <path-to-project> [--json]');
    process.exit(1);
  }

  const root = path.resolve(targetArg);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Error: ${root} is not a directory`);
    process.exit(1);
  }

  let allFindings = [];
  allFindings = allFindings.concat(checkEnvFiles(root));

  walk(root, (filePath) => {
    const ext = path.extname(filePath);
    const base = path.basename(filePath);
    if (CODE_EXTENSIONS.has(ext) || ENV_FILENAMES.has(base)) {
      allFindings = allFindings.concat(scanFile(filePath, root));
    }
  });

  allFindings.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));

  if (jsonOutput) {
    console.log(JSON.stringify({ root, findings: allFindings }, null, 2));
    return;
  }

  if (allFindings.length === 0) {
    console.log('No issues found by the quick scan. This does not mean the app is secure —');
    console.log('run the manual checklist review in references/checklist.md next.');
    return;
  }

  const counts = {};
  for (const f of allFindings) counts[f.severity] = (counts[f.severity] || 0) + 1;

  console.log(`Quick scan of ${root}`);
  console.log(
    'Found: ' +
      ['critical', 'high', 'medium', 'low']
        .filter((s) => counts[s])
        .map((s) => `${counts[s]} ${s}`)
        .join(', ')
  );
  console.log('-'.repeat(70));

  for (const f of allFindings) {
    const loc = f.file + (f.line ? `:${f.line}` : '');
    console.log(`[${f.severity.toUpperCase()}] ${f.description || f.rule}`);
    console.log(`  Location: ${loc}`);
    console.log(`  Match:    ${f.match}`);
    console.log(`  Note:     ${f.note}`);
    console.log('');
  }

  console.log('-'.repeat(70));
  console.log('This is a fast automated pass only — false positives are possible (review each');
  console.log('match), and it will NOT catch logic issues like missing authorization checks or');
  console.log('IDOR. Follow up with the manual checklist in references/checklist.md.');
}

main();
