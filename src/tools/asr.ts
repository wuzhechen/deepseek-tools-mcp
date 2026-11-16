import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import { postMultipart } from "../http.js";
import { humanBytes, resolveReadableFile } from "../util.js";

const MAX_ASR_BYTES = 8 * 1024 * 1024;

export const asrInput = {
  file_path: z
    .string()
    .describe(
      "Local path to a 16-bit PCM WAV or Ogg Opus file. Max 8 MiB and 120 seconds; stereo is transcribed from the left channel only."
    ),
};

export interface AsrArgs {
  file_path: string;
}

interface AsrResponse {
  request_id?: string;
  text?: string;
  duration_ms?: number;
}

export async function runAsr(args: AsrArgs): Promise<string> {
  const file = await resolveReadableFile(args.file_path);
  const info = await stat(file);

  if (info.size > MAX_ASR_BYTES) {
    throw new Error(
      `File too large: ${humanBytes(info.size)}. ASR accepts up to 8 MiB.`
    );
  }

  const form = new FormData();
  const blob = await openAsBlob(file).catch(async () => null);
  if (!blob) {
    throw new Error(`Could not read file as a blob: ${file}`);
  }
  form.append("file", blob, basename(file));

  const data = await postMultipart<AsrResponse>("/asr", form, 120_000);
  const text = (data.text ?? "").trim();

  return [
    `text: ${text || "(empty transcript)"}`,
    `duration_ms: ${data.duration_ms ?? "unknown"}`,
    data.request_id ? `request_id: ${data.request_id}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
