import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const onVercel = Boolean(process.env.VERCEL);
const site = (process.env.MESA_SITE ?? "").trim() || (onVercel ? "" : "demo");

const fail = (message) => {
  console.error(`\n[MESA] ${message}\n`);
  process.exit(1);
};

if (!site)
  fail(
    "MESA_SITE is not set. Add it in Vercel → Settings → Environment Variables (e.g. MESA_SITE=kebab-house).",
  );
if (!/^[a-z0-9-]+$/.test(site))
  fail(
    `MESA_SITE="${site}" isn't a valid site name (lowercase letters, numbers and dashes).`,
  );

const dir = join(root, "sites", site);
const source = join(dir, "config.json");
if (!existsSync(source))
  fail(
    `sites/${site}/config.json doesn't exist. Create it with: npm run new-site -- <config.json>`,
  );

const target = join(root, "config", "config.json");
const json = readFileSync(source, "utf8");
try {
  JSON.parse(json);
} catch (error) {
  fail(`sites/${site}/config.json isn't valid JSON: ${error.message}`);
}
if (!existsSync(target) || readFileSync(target, "utf8") !== json)
  writeFileSync(target, json);

const publicTarget = join(root, "public", "site");
rmSync(publicTarget, { recursive: true, force: true });
const publicSource = join(dir, "public");
if (existsSync(publicSource))
  cpSync(publicSource, publicTarget, { recursive: true });

console.log(`[MESA] Site: ${site}`);
