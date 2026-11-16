import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { allowedDirs, maxOutputChars } from "./config.js";

/** Expand a leading `~` without touching other path parts. */
export function expandHome(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return path.join(homedir(), input.slice(2));
  return input;
}

/**
 * Resolve a user-supplied local file path for reading.
 * When DEEPSEEK_TOOLS_ALLOWED_DIRS is set, the path must stay inside one of those dirs.
 */
export async function resolveReadableFile(input: string): Promise<string> {
  const absolute = path.resolve(expandHome(input));
  const roots = allowedDirs();

  if (roots.length > 0) {
    const permitted = roots.some((root) => {
      const relative = path.relative(path.resolve(expandHome(root)), absolute);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
    if (!permitted) {
      throw new Error(
        `Access denied: "${input}" is outside DEEPSEEK_TOOLS_ALLOWED_DIRS.`
      );
    }
  }

  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`File not found: ${absolute}`);
  }
  return absolute;
}

/** Create the parent directory of a file path if needed. */
export async function ensureParentDir(file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
}

export interface TruncatedText {
  text: string;
  truncated: boolean;
  totalChars: number;
}

/** Cap text handed back to the model so a huge page cannot flood the context. */
export function truncateText(
  text: string,
  max = maxOutputChars()
): TruncatedText {
  const totalChars = text.length;
  if (totalChars <= max) return { text, truncated: false, totalChars };
  return { text: text.slice(0, max), truncated: true, totalChars };
}

export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
