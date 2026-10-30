import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configSchema } from "../config/schema";

type Json = Record<string, unknown>;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const privateDir = join(root, ".private");

const fail = (message: string): never => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const force = args.includes("--force");
const file = args.find(
  (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"),
);
if (!file)
  fail(
    "Pass the config.json from the onboarding email: npm run new-site -- <file> [--slug name] [--domain example.com] [--api https://…]",
  );

const SHARED_WEB = `# Same for every MESA client. new-site copies these into each client's web.env.
NEXT_PUBLIC_MEDIA_URL=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
`;
const SHARED_API = `# Same for every MESA client. new-site copies these into each client's api.env.
# The Atlas cluster WITHOUT a database name. Each client gets its own database on it:
#   mongodb+srv://user:pass@cluster0.xxxx.mongodb.net
MONGODB_CLUSTER_URI=
# Who emails come from: "<Restaurant name> <this address>"
MAIL_FROM_EMAIL=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
MEDIA_BASE_URL=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Where the API finds the site's config on Render (repo root has client/ and server/)
SITES_PATH=../client/sites
# Every client's preview address, before their own domain is ready: <slug>.<this>
PREVIEW_DOMAIN=mesa-template.store
# How many proxies Render puts in front of the API (find it once on the demo API with
# SHOW_CLIENT_IP=true, see the setup notes). Same for every client on Render.
TRUST_PROXY=
`;

function readEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

function prefill(
  text: string,
  values: Record<string, string>,
  overwriteDefaults: boolean,
) {
  return text.replace(
    /^([A-Z0-9_]+)=(.*)$/gm,
    (line, key: string, current: string) => {
      const v = values[key];
      return v && (overwriteDefaults || !current.trim()) ? `${key}=${v}` : line;
    },
  );
}

// Where your local settings live: client/.env* and the API's ../server/.env*
const ENV_NAMES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
];
const webEnvFiles = ENV_NAMES.map((n) => join(root, n)).filter((p) =>
  existsSync(p),
);
const apiEnvFiles = ["server", "api", "mesa-api", "backend"]
  .flatMap((dir) => ENV_NAMES.map((n) => join(root, "..", dir, n)))
  .filter((p) => existsSync(p));
const merge = (files: string[]) =>
  files.reduce<Record<string, string>>(
    (all, p) => ({ ...all, ...readEnv(p) }),
    {},
  );

const localWeb = merge(webEnvFiles);
const localApi = (() => {
  const api = merge(apiEnvFiles);
  let cluster = "";
  try {
    const u = new URL(api.MONGODB_URI ?? "");
    u.pathname = "/";
    cluster = u.toString();
  } catch {}
  const from = api.MAIL_FROM ?? "";
  return {
    ...api,
    MONGODB_CLUSTER_URI: cluster,
    MAIL_FROM_EMAIL:
      from.match(/<([^>]+)>/)?.[1] ?? (from.includes("@") ? from : ""),
  };
})();

mkdirSync(privateDir, { recursive: true });
const sharedWebPath = join(privateDir, "shared.web.env");
const sharedApiPath = join(privateDir, "shared.api.env");
const firstRun = !existsSync(sharedWebPath) || !existsSync(sharedApiPath);

// Create the files, or fill lines that are still empty
for (const [path, template, values] of [
  [sharedWebPath, SHARED_WEB, localWeb],
  [sharedApiPath, SHARED_API, localApi],
] as const) {
  const exists = existsSync(path);
  const before = exists ? readFileSync(path, "utf8") : template;
  const after = prefill(before, values, !exists);
  if (!exists || after !== before) writeFileSync(path, after);
}

const sharedWeb = readEnv(sharedWebPath);
const sharedApi = readEnv(sharedApiPath);
// Files made before TRUST_PROXY was added to the template: add the line once
if (!("TRUST_PROXY" in sharedApi)) {
  writeFileSync(
    sharedApiPath,
    `${readFileSync(sharedApiPath, "utf8").replace(/\s*$/, "\n")}# How many proxies Render puts in front of the API (same for every client)\nTRUST_PROXY=\n`,
  );
  sharedApi.TRUST_PROXY = "";
}
const missing = [
  "MONGODB_CLUSTER_URI",
  "MAIL_FROM_EMAIL",
  "S3_BUCKET",
  "AWS_REGION",
  "MEDIA_BASE_URL",
  // without it every visitor shares one rate limit (they all look like Render's proxy)
  "TRUST_PROXY",
].filter((k) => !sharedApi[k]);
const looked = `Local settings read from:\n${[...webEnvFiles, ...apiEnvFiles].map((p) => `    ${p}`).join("\n") || "    (no .env files found next to client/ or in ../server/)"}`;

if (missing.length) {
  fail(
    `Still empty in .private/shared.api.env: ${missing.join(", ")}\n  Type them into that file, then run again.\n  ${looked}`,
  );
}
if (firstRun) {
  fail(
    `Created .private/shared.web.env and .private/shared.api.env from your local settings.\n  Check them once (especially AWS, SMTP and Google), then run this again.\n  ${looked}`,
  );
}

/* ───────────── the config ───────────── */

const path = resolve(process.cwd(), file!);
if (!existsSync(path)) fail(`Can't find ${path}`);
let raw: Json = {};
try {
  raw = JSON.parse(readFileSync(path, "utf8")) as Json;
} catch (error) {
  fail(`${file} isn't valid JSON: ${(error as Error).message}`);
}
/* Repairs drafts from older versions of the form (and anything left empty), before the check */
const repairs: string[] = [];
{
  const g = (keys: string) =>
    keys
      .split(".")
      .reduce<unknown>(
        (o, k) => (o && typeof o === "object" ? (o as Json)[k] : undefined),
        raw,
      );
  const turnOff = (node: unknown, key: string): number => {
    if (Array.isArray(node))
      return node.reduce((n: number, v) => n + turnOff(v, key), 0);
    if (!node || typeof node !== "object") return 0;
    const obj = node as Json;
    let n = 0;
    if (obj[key] === true) {
      obj[key] = false;
      n++;
    }
    return (
      n +
      Object.values(obj).reduce((sum: number, v) => sum + turnOff(v, key), 0)
    );
  };

  // A second currency that's the same as the main one
  const currency = g("menu.currency") as
    | { primary?: Json; secondary?: Json }
    | undefined;
  if (
    currency?.secondary &&
    currency.secondary.code === currency.primary?.code
  ) {
    delete currency.secondary;
    repairs.push(
      `menu.currency: removed the second currency (it was ${String(currency.primary?.code)} too)`,
    );
  }

  // The domain must be bare ("place.com"); none yet → example.com, to replace later
  const integrations = g("integrations") as Json | undefined;
  if (integrations) {
    const before = String(integrations.customDomain ?? "");
    const bare = before
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");
    const domain = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(bare)
      ? bare
      : "example.com";
    if (domain !== before) {
      integrations.customDomain = domain;
      repairs.push(
        `integrations.customDomain: "${before}" → "${domain}"${domain === "example.com" ? " (replace it once they have a domain)" : ""}`,
      );
    }
  }

  // Maps need business.geo
  const geo = g("business.geo") as Json | undefined;
  if (!geo || typeof geo.lat !== "number" || typeof geo.lng !== "number") {
    const n = turnOff(raw, "showMap");
    if (n)
      repairs.push(
        `showMap: switched off in ${n} place${n === 1 ? "" : "s"}: there's no location. Add business.geo { "lat": …, "lng": … } and switch it back on`,
      );
  }

  const socials = g("business.socials");
  if (!Array.isArray(socials) || socials.length === 0) {
    const footer = g("layout.footer") as Json | undefined;
    const n =
      turnOff(raw, "showSocials") +
      (footer && footer.showSocials !== false
        ? ((footer.showSocials = false), 1)
        : 0);
    if (n)
      repairs.push(
        "showSocials: switched off: they gave no Instagram/Facebook/TikTok",
      );
  }
}
if (repairs.length)
  console.log(
    `\nFixed automatically:\n${repairs.map((r) => `  • ${r}`).join("\n")}`,
  );

const checked = configSchema.safeParse(raw);
if (!checked.success) {
  fail(
    `The config doesn't pass the schema. Fix these in the file, then run again:\n${checked.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n")}`,
  );
}

const get = (obj: unknown, keys: string): unknown =>
  keys
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Json)[k] : undefined),
      obj,
    );
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const name = str(get(raw, "brand.name")) || fail("brand.name is empty");
const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
const slug = flag("slug") ?? slugify(name);
if (!/^[a-z0-9-]+$/.test(slug) || slug === "demo")
  fail(`"${slug}" can't be used as the site name. Pass one with --slug`);

const siteDir = join(root, "sites", slug);
if (existsSync(join(siteDir, "config.json")) && !force)
  fail(
    `sites/${slug} already exists. Use another --slug, or --force to overwrite.`,
  );

const demoUrl = (() => {
  try {
    return str(
      get(
        JSON.parse(
          readFileSync(join(root, "sites", "demo", "config.json"), "utf8"),
        ),
        "seo.siteUrl",
      ),
    );
  } catch {
    return "";
  }
})();
const preview = `https://${slug}.${sharedApi.PREVIEW_DOMAIN || "mesa-template.store"}`;
const formUrl = str(get(raw, "seo.siteUrl")).replace(/\/+$/, "");
const domainFlag = flag("domain")
  ?.replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "");
const webUrl = domainFlag
  ? `https://${domainFlag}`
  : formUrl && formUrl !== demoUrl.replace(/\/+$/, "")
    ? formUrl
    : preview;
const apiUrl = (flag("api") ?? `https://mesa-${slug}-api.onrender.com`)
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");
const apiBase = `${apiUrl}/api/v1`;

const address = get(raw, "business.address") as Json | undefined;
const addressLine = address
  ? [address.street, address.city, address.country]
      .map(str)
      .filter(Boolean)
      .join(", ")
  : "";
const logo = str(get(raw, "brand.logo.light"));
const secret = () => randomBytes(48).toString("base64url");
const proxySecret = secret();

mkdirSync(join(siteDir, "public"), { recursive: true });
writeFileSync(
  join(siteDir, "config.json"),
  `${JSON.stringify(raw, null, 2)}\n`,
);
const keep = join(siteDir, "public", "README.md");
if (!existsSync(keep))
  writeFileSync(
    keep,
    `# ${name}: images\n\nPut this restaurant's logo and photos here. In config.json refer to them as\n"site/<file>" (for example "site/hero.webp"): this folder is served at /site/ for this site only.\n`,
  );

const out = join(privateDir, slug);
mkdirSync(out, { recursive: true });

const envFile = (title: string, entries: [string, string | undefined][]) =>
  `# ${title}\n# Generated by new-site on ${new Date().toISOString().slice(0, 10)}. Keep private.\n${entries
    .map(([k, v]) => (k.startsWith("#") ? `\n${k}` : `${k}=${v ?? ""}`))
    .join("\n")}\n`;

const {
  MONGODB_CLUSTER_URI,
  MAIL_FROM_EMAIL,
  SITES_PATH,
  PREVIEW_DOMAIN,
  ...apiShared
} = sharedApi;
void PREVIEW_DOMAIN;

const mongo = (() => {
  try {
    const u = new URL(MONGODB_CLUSTER_URI);
    u.pathname = `/mesa_${slug.replace(/-/g, "_")}`;
    if (!u.search) u.search = "?retryWrites=true&w=majority";
    return u.toString();
  } catch {
    return fail(
      "MONGODB_CLUSTER_URI in .private/shared.api.env isn't a valid MongoDB URI",
    );
  }
})();

writeFileSync(
  join(out, "web.env"),
  envFile(`${name}: Vercel project "mesa-${slug}"`, [
    ["MESA_SITE", slug],
    ["API_URL", apiBase],
    ["NEXT_PUBLIC_API_URL", apiBase],
    ["IRON_SESSION_PASSWORD", secret()],
    ["API_PROXY_SECRET", proxySecret],
    ...Object.entries(sharedWeb),
  ]),
);

writeFileSync(
  join(out, "api.env"),
  envFile(`${name}: Render service "mesa-${slug}-api"`, [
    ["NODE_ENV", "production"],
    ["MONGODB_URI", mongo],
    ["CLIENT_ORIGIN", webUrl],
    ["WEB_URL", webUrl],
    [
      "SITE_CONFIG_PATH",
      `${(SITES_PATH || "../client/sites").replace(/\/+$/, "")}/${slug}/config.json`,
    ],
    ["S3_KEY_PREFIX", `${slug}/`],
    ["COOKIE_SECRET", secret()],
    ["JWT_ACCESS_SECRET", secret()],
    ["JWT_REFRESH_SECRET", secret()],
    ["ORDER_SIGNING_SECRET", secret()],
    ["INTERNAL_PROXY_SECRET", proxySecret],
    ["MFA_ENCRYPTION_KEY", secret()],
    ["MAIL_FROM", `"${name.replace(/"/g, "")} <${MAIL_FROM_EMAIL}>"`],
    ["BRAND_NAME", `"${name.replace(/"/g, "")}"`],
    ["BRAND_COLOR", str(get(raw, "theme.colors.light.primary"))],
    ["BRAND_TIMEZONE", str(get(raw, "business.timezone"))],
    ["BRAND_ADDRESS", `"${addressLine.replace(/"/g, "")}"`],
    ["BRAND_LOGO_URL", logo ? `${webUrl}/${logo}` : ""],
    ...Object.entries(apiShared),
    ["API_PUBLIC_URL", apiUrl],
  ]),
);

const features = (get(raw, "features") ?? {}) as Json;
const on = (k: string) => features[k] === true;
writeFileSync(
  join(out, "CHECKLIST.md"),
  `# ${name}: going live

Site: \`${slug}\` · Website: ${webUrl} · API: ${apiUrl}

## 1. Code
- [ ] Put their logo and photos in \`client/sites/${slug}/public/\` and point config.json at them (\`"site/…"\`)
- [ ] Preview locally: \`MESA_SITE=${slug} npm run dev\`
- [ ] Commit and push \`client/sites/${slug}/\` (never \`.private/\`)

## 2. API on Render
- [ ] New Web Service from the MESA repo, name **mesa-${slug}-api**, same build/start settings as the demo API
- [ ] Environment → paste \`.private/${slug}/api.env\`
- [ ] Deploy and open ${apiUrl} (it should answer)

## 3. Website on Vercel
- [ ] Add New → Project → the MESA repo, name **mesa-${slug}**, root directory \`client\`
- [ ] Environment Variables → paste \`.private/${slug}/web.env\` (do NOT add ONBOARDING_ENABLED)
- [ ] Deploy
- [ ] Domains → add ${webUrl.replace("https://", "")}${webUrl === preview ? " (your preview subdomain)" : " and set the DNS records Vercel shows"}

## 4. Accounts
- [ ] Create the owner's admin account
${get(raw, "integrations") ? "- [ ] Google sign-in: add the domain to the OAuth client's authorised origins\n" : ""}- [ ] Menu: enter it in the admin panel, or seed it

## 5. Test before handing over
- [ ] Phone + desktop: pages, menu, photos, colours, opening hours
${on("reservations") ? "- [ ] A test booking: the confirmation email arrives\n" : ""}${on("onlineOrdering") ? "- [ ] A test order (cash), and it shows in the admin panel\n" : ""}- [ ] Contact form email arrives
- [ ] Send the owner the admin link and login
`,
);

console.log(`
✔ ${name} is set up as "${slug}"

  client/sites/${slug}/config.json     commit this
  client/sites/${slug}/public/         add their photos here
  client/.private/${slug}/web.env      → Vercel
  client/.private/${slug}/api.env      → Render
  client/.private/${slug}/CHECKLIST.md → the rest

Preview it now:  MESA_SITE=${slug} npm run dev
`);
