import "server-only";

import rawConfig from "./config.json";
import { configSchema, type SiteConfig } from "./schema";

let cached: SiteConfig | null = null;

export function getConfig(): SiteConfig {
  if (cached) return cached;

  const result = configSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`[MESA] Invalid config.json:\n${issues}`);
  }

  cached = result.data;
  return cached;
}
