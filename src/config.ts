import { delimiter } from "node:path";

export const SERVER_NAME = "deepseek-tools-mcp";
export const SERVER_VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://api.deepseek.com/v1/tools";

/** Base URL of DeepSeek's standalone tools API (no trailing slash). */
export function baseUrl(): string {
  const raw = process.env.DEEPSEEK_TOOLS_BASE_URL?.trim();
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** Resolve the API key lazily so tests can set it per-case and errors stay actionable. */
export function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Set it in the environment of the MCP server process."
    );
  }
  return key;
}

/** Maximum characters returned to the model per call (default 20000). */
export function maxOutputChars(): number {
  const n = Number(process.env.DEEPSEEK_TOOLS_MAX_OUTPUT_CHARS ?? "");
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : 20000;
}

/**
 * Optional allowlist for local file reads. Empty means "any path the user names".
 * Split by the platform path delimiter (`:` on macOS/Linux, `;` on Windows).
 */
export function allowedDirs(): string[] {
  return (process.env.DEEPSEEK_TOOLS_ALLOWED_DIRS ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
