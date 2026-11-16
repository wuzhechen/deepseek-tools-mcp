import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { postBinary } from "../http.js";
import { ensureParentDir, expandHome } from "../util.js";

const MAX_TTS_BODY_BYTES = 64 * 1024;

export const ttsInput = {
  text: z
    .string()
    .min(1)
    .describe(
      "Text to synthesize. The API accepts up to 10000 billed characters (Chinese counts as 2) and a 64 KiB request body."
    ),
  voice_id: z
    .enum(["stella", "tide"])
    .default("stella")
    .describe("Voice: stella (default, female) or tide (male)."),
  format: z
    .enum(["wav", "pcm"])
    .default("wav")
    .describe("Audio format: wav (default) or raw pcm (24 kHz, 16-bit, mono)."),
  filter_markdown: z
    .boolean()
    .default(true)
    .describe("Strip Markdown before synthesis. Default true."),
  output_path: z
    .string()
    .optional()
    .describe(
      "Where to write the audio file. Defaults to ~/.cache/deepseek-tools-mcp/tts-<timestamp>.<format>."
    ),
};

export interface TtsArgs {
  text: string;
  voice_id?: "stella" | "tide";
  format?: "wav" | "pcm";
  filter_markdown?: boolean;
  output_path?: string;
}

export async function runTts(args: TtsArgs): Promise<string> {
  const format = args.format ?? "wav";
  const bodyBytes = Buffer.byteLength(args.text, "utf8");
  if (bodyBytes > MAX_TTS_BODY_BYTES) {
    throw new Error(
      `Request body is ${bodyBytes} bytes; TTS accepts at most 64 KiB of JSON body.`
    );
  }

  const { data, contentType } = await postBinary(
    "/tts",
    {
      text: args.text,
      voice_id: args.voice_id ?? "stella",
      format,
      filter_markdown: args.filter_markdown ?? true,
    },
    180_000
  );

  let target = args.output_path
    ? path.resolve(expandHome(args.output_path))
    : path.join(
        homedir(),
        ".cache",
        "deepseek-tools-mcp",
        `tts-${Date.now()}.${format}`
      );

  if (!path.extname(target)) target += `.${format}`;

  await ensureParentDir(target);
  await writeFile(target, data);

  return [
    `saved: ${target}`,
    `format: ${format}${format === "pcm" ? " (24 kHz, 16-bit, mono raw PCM)" : ""}`,
    `content_type: ${contentType}`,
    `bytes: ${data.length}`,
  ].join("\n");
}
