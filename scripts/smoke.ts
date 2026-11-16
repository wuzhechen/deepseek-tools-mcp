import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runAsr } from "../src/tools/asr.js";
import { runFetch } from "../src/tools/fetch.js";
import { runOcr } from "../src/tools/ocr.js";
import { runSearch } from "../src/tools/search.js";
import { runTts } from "../src/tools/tts.js";

/**
 * Live smoke test. Requires DEEPSEEK_API_KEY.
 * Optional: SMOKE_OCR_FILE=/path/file.pdf SMOKE_ASR_FILE=/path/audio.wav
 */
async function main(): Promise<void> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY is required for the smoke test.");
    process.exit(1);
  }

  console.log("== search ==");
  console.log((await runSearch({ query: "DeepSeek Search API", count: 2 })).slice(0, 600));

  console.log("\n== fetch ==");
  console.log((await runFetch({ url: "https://example.com", max_chars: 400 })).slice(0, 600));

  console.log("\n== tts ==");
  const output = path.join(tmpdir(), `deepseek-tools-mcp-smoke-${Date.now()}.wav`);
  const ttsResult = await runTts({ text: "你好，这是一次冒烟测试。", output_path: output });
  console.log(ttsResult);
  await unlink(output).catch(() => undefined);

  if (process.env.SMOKE_OCR_FILE) {
    console.log("\n== ocr ==");
    console.log((await runOcr({ file_path: process.env.SMOKE_OCR_FILE })).slice(0, 600));
  } else {
    console.log("\n== ocr == skipped (set SMOKE_OCR_FILE)");
  }

  if (process.env.SMOKE_ASR_FILE) {
    console.log("\n== asr ==");
    console.log((await runAsr({ file_path: process.env.SMOKE_ASR_FILE })).slice(0, 600));
  } else {
    console.log("== asr == skipped (set SMOKE_ASR_FILE)");
  }
}

main().catch((error) => {
  console.error("smoke test failed:", error);
  process.exit(1);
});
