// Fails (exit 1) if anything secret is in the client bundle (.next/static). Checks:
//   1. the actual values of server-only env vars, if they are set in this shell / .env.local
//   2. Supabase secret-key-shaped strings (sb_secret_ followed by a long token; the bare prefix appears in supabase-js itself)
//   3. any JWT-shaped string whose decoded payload has role "service_role"
//   4. server-only variable NAMES that must never be referenced by client code
import fs from "node:fs";
import path from "node:path";

try { process.loadEnvFile(".env.local"); } catch { /* optional */ }
const root = ".next/static";
if (!fs.existsSync(root)) { console.error("No .next/static: run `npm run build` first."); process.exit(2); }

const secrets = ["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "CRON_SECRET"]
  .map((n) => [n, process.env[n]]).filter(([, v]) => v && v.length >= 16);
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : /\.(js|css|html|json|map|txt)$/.test(e.name) && files.push(p); } })(root);

const findings = [];
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const [name, value] of secrets) if (text.includes(value)) findings.push(`${f}: contains the value of ${name}`);
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(text)) findings.push(`${f}: Supabase secret-key-shaped string`);
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
    try { if (JSON.parse(Buffer.from(m[1], "base64url").toString()).role === "service_role") findings.push(`${f}: a service_role JWT`); } catch { /* not a JWT */ }
  }
  for (const name of ["SERVICE_ROLE_KEY", "RESEND_API_KEY", "CRON_SECRET"]) if (text.includes(name)) findings.push(`${f}: references ${name}`);
}
console.log(`Scanned ${files.length} files in ${root}; checked ${secrets.length} secret value(s) from the environment.`);
if (findings.length) { console.error(findings.join("\n")); process.exit(1); }
console.log("Clean: no secrets or server-only names in the client bundle.");
