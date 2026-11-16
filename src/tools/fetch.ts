import { z } from "zod";
import { postJson } from "../http.js";

export const fetchInput = {
  url: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "Only http(s) URLs are supported.",
    })
    .describe("Page URL to fetch (http or https, max 8192 characters)."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Start offset in characters, for paging through a long page."),
  max_chars: z
    .number()
    .int()
    .min(1_000)
    .max(50_000)
    .default(20_000)
    .describe("Maximum characters to return per call (1000-50000). Default 20000."),
};

export interface FetchArgs {
  url: string;
  offset?: number;
  max_chars?: number;
}

interface FetchResponse {
  content?: string;
}

export async function runFetch(args: FetchArgs): Promise<string> {
  const data = await postJson<FetchResponse>("/fetch", { url: args.url }, 60_000);
  const content = typeof data.content === "string" ? data.content : "";

  if (content.length === 0) {
    return `URL: ${args.url}\n\nThe page returned no readable content.`;
  }

  const start = Math.min(args.offset ?? 0, content.length);
  const end = Math.min(start + (args.max_chars ?? 20_000), content.length);
  const chunk = content.slice(start, end);
  const truncated = end < content.length;
  const next = truncated ? ` | next offset: ${end}` : "";

  return [
    `URL: ${args.url}`,
    `chars: ${start}-${end} of ${content.length}${next}`,
    "",
    chunk,
  ].join("\n");
}
