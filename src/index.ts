#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME, SERVER_VERSION, apiKey } from "./config.js";
import { asrInput, runAsr } from "./tools/asr.js";
import { fetchInput, runFetch } from "./tools/fetch.js";
import { ocrInput, runOcr } from "./tools/ocr.js";
import { runSearch, searchInput } from "./tools/search.js";
import { runTts, ttsInput } from "./tools/tts.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function textResult(text: string, isError = false): ToolResult {
  return isError
    ? { content: [{ type: "text", text }], isError: true }
    : { content: [{ type: "text", text }] };
}

async function safe(run: () => Promise<string>): Promise<ToolResult> {
  try {
    return textResult(await run());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return textResult(`Error: ${message}`, true);
  }
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
  "deepseek_search",
  {
    title: "DeepSeek Web Search",
    description:
      "Search the web with DeepSeek's Search API. Returns titles, URLs, snippets/summaries, dates and source authority. Supports search operators and an original-question hint.",
    inputSchema: searchInput,
  },
  async (args) => safe(() => runSearch(args))
);

server.registerTool(
  "deepseek_fetch",
  {
    title: "DeepSeek Fetch",
    description:
      "Fetch a web page through DeepSeek's Fetch API and return its readable content as Markdown. Supports character-offset paging for long pages.",
    inputSchema: fetchInput,
  },
  async (args) => safe(() => runFetch(args))
);

server.registerTool(
  "deepseek_ocr",
  {
    title: "DeepSeek OCR",
    description:
      "Extract text from a local PDF, Word, PowerPoint or image file with DeepSeek's OCR API. Returns per-page text.",
    inputSchema: ocrInput,
  },
  async (args) => safe(() => runOcr(args))
);

server.registerTool(
  "deepseek_asr",
  {
    title: "DeepSeek ASR",
    description:
      "Transcribe a local WAV (16-bit PCM) or Ogg Opus audio file with DeepSeek's ASR API. Max 8 MiB / 120 seconds.",
    inputSchema: asrInput,
  },
  async (args) => safe(() => runAsr(args))
);

server.registerTool(
  "deepseek_tts",
  {
    title: "DeepSeek TTS",
    description:
      "Synthesize speech with DeepSeek's TTS API and write the audio to a local file. Returns the saved path, format and byte size.",
    inputSchema: ttsInput,
  },
  async (args) => safe(() => runTts(args))
);

async function main(): Promise<void> {
  // Fail fast with a clear message instead of failing on the first tool call.
  try {
    apiKey();
  } catch (error) {
    console.error(
      `[${SERVER_NAME}] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[${SERVER_NAME}] v${SERVER_VERSION} ready on stdio. Tools: deepseek_search, deepseek_fetch, deepseek_ocr, deepseek_asr, deepseek_tts`
  );
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] fatal:`, error);
  process.exit(1);
});
