// Post-deploy smoke test against a LIVE URL. Usage: npm run smoke:live -- https://your-app.vercel.app
// Read-only apart from one burst of GETs to /validate/<random> (to show the 429), which only rate-limits this machine's IP.
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^(https:\/\/|http:\/\/localhost)/.test(base)) { console.error("Give the https:// URL of the deployment."); process.exit(2); }

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); if (!ok) failed++; };
const get = (p, opts = {}) => fetch(base + p, { redirect: "manual", ...opts });

const home = await get("/");
const h = home.headers;
check("GET / is 200", home.status === 200, String(home.status));
const csp = h.get("content-security-policy") ?? "";
check("CSP present with frame-ancestors 'none' and object-src 'none'", /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp));
const local = base.startsWith("http://localhost");
check("CSP connect-src allows the Supabase project", local ? /connect-src[^;]*127\.0\.0\.1/.test(csp) : /connect-src[^;]*\.supabase\.co/.test(csp));
check("HSTS present", /max-age=\d{7,}/.test(h.get("strict-transport-security") ?? ""));
check("X-Content-Type-Options: nosniff", h.get("x-content-type-options") === "nosniff");
check("Referrer-Policy set", !!h.get("referrer-policy"));
check("Permissions-Policy set", !!h.get("permissions-policy"));
check("X-Frame-Options DENY", h.get("x-frame-options") === "DENY");
check("No X-Powered-By", !h.get("x-powered-by"));

const demo = await get("/demo");
const demoText = await demo.text();
check("/demo is 200 and noindex", demo.status === 200 && /noindex/.test(demo.headers.get("x-robots-tag") ?? ""), String(demo.status));
check("/demo shows the fictional learner, clearly labelled", /Jo \(DEMO\)/.test(demoText) && /Demo data/i.test(demoText));
check("/demo leaks no emails, hashes or paths", !/validator_email|token_hash|storage_path|@example\.test/.test(demoText));

check("/privacy is 200", (await get("/privacy")).status === 200);
const robots = await (await get("/robots.txt")).text();
check("robots.txt disallows /app/, /validate/ and /api/", /Disallow: \/app\//.test(robots) && /Disallow: \/validate\//.test(robots) && /Disallow: \/api\//.test(robots));
check("unknown page is a real 404", (await get("/definitely-not-a-page")).status === 404);
const app = await get("/app");
check("/app redirects a signed-out visitor to /login", [302, 303, 307, 308].includes(app.status) && /\/login/.test(app.headers.get("location") ?? ""), `${app.status} ${app.headers.get("location") ?? ""}`);
const v = await get(`/validate/${"A".repeat(43)}`);
check("/validate with an unknown token gives the generic page", v.status === 200 && /isn.t valid/i.test(await v.text()), String(v.status));
check("sweep job route is closed without its secret", (await get("/api/cron/sweep-evidence")).status === 404);
const evil = await get("/auth/signout", { method: "POST", headers: { origin: "https://evil.example" } });
check("sign-out refuses cross-site posts", evil.status === 403, String(evil.status));

// Burst: validator links allow 60 per 10 minutes per IP.
const statuses = [];
for (let i = 0; i < 70; i++) statuses.push((await get(`/validate/${"B".repeat(43)}`)).status);
const first429 = statuses.indexOf(429);
check("burst of 70 validator-link requests gets HTTP 429", first429 > 0 && statuses.slice(first429).every((s) => s === 429), `first 429 at request ${first429 + 1}`);

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll live checks passed.");
process.exit(failed ? 1 : 0);
