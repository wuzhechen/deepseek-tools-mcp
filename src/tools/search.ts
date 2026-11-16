import { z } from "zod";
import { postJson } from "../http.js";
import { truncateText } from "../util.js";

export const searchInput = {
  query: z
    .string()
    .min(1)
    .max(128)
    .describe(
      "Search query, 1-128 characters. Supports site:/ -site:, -term, \"exact phrase\", lang:, after:, before:."
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of results to request (1-50). Default 10."),
  ori_question: z
    .string()
    .max(128)
    .optional()
    .describe(
      "Original user question, truncated to 128 characters. Sent as ori_question to improve recall."
    ),
  need_content: z
    .boolean()
    .default(false)
    .describe("Ask the API to include page content in results (heavier response)."),
  localization: z
    .string()
    .optional()
    .describe("Optional IP/locale hint used for localized results."),
};

export interface SearchArgs {
  query: string;
  count?: number;
  ori_question?: string;
  need_content?: boolean;
  localization?: string;
}

interface SearchResult {
  title?: string;
  url?: string;
  snippet?: string;
  summary?: string;
  date?: string;
  authority?: number;
}

interface SearchResponse {
  results?: SearchResult[];
}

export async function runSearch(args: SearchArgs): Promise<string> {
  const body: Record<string, unknown> = {
    query: args.query,
    count: args.count ?? 10,
  };
  if (args.ori_question) body.ori_question = args.ori_question.slice(0, 128);
  if (args.need_content) body.need_content = true;
  if (args.localization) body.localization = args.localization;

  const data = await postJson<SearchResponse>("/search", body, 30_000);
  const results = Array.isArray(data.results) ? data.results : [];

  if (results.length === 0) {
    return "No results found.";
  }

  const blocks = results.map((result, index) => {
    const title = (result.title ?? "(untitled)").trim();
    const url = (result.url ?? "").trim();
    const excerpt = (result.summary ?? result.snippet ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const meta = [
      result.date ? `date: ${result.date}` : "",
      typeof result.authority === "number" ? `authority: ${result.authority}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    return [
      `${index + 1}. ${title}`,
      url ? `   ${url}` : "",
      excerpt ? `   ${excerpt}` : "",
      meta ? `   ${meta}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const joined = blocks.join("\n\n");
  const capped = truncateText(joined);
  if (!capped.truncated) return joined;

  return `${capped.text}\n\n[truncated: showing ${capped.text.length} of ${capped.totalChars} characters]`;
}
