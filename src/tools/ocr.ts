import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import { postMultipart } from "../http.js";
import { humanBytes, resolveReadableFile, truncateText } from "../util.js";

const MAX_OCR_BYTES = 100 * 1024 * 1024;

export const ocrInput = {
  file_path: z
    .string()
    .describe(
      "Local path to a PDF, Word (doc/docx), PowerPoint (ppt/pptx), or image (png/jpeg/webp/gif/bmp/tiff). Max 100 MiB, 1000 pages."
    ),
  purpose: z
    .enum(["text_recognition", "rich_layout_recognition"])
    .default("text_recognition")
    .describe(
      "text_recognition extracts text directly from text-only Office files and OCRs other files page by page; rich_layout_recognition OCRs every page."
    ),
};

export interface OcrArgs {
  file_path: string;
  purpose?: "text_recognition" | "rich_layout_recognition";
}

interface OcrResponse {
  id?: string;
  object?: string;
  page_count?: number;
  pages?: Array<{
    index?: number;
    text?: string;
    finish_reason?: string;
  }>;
}

export async function runOcr(args: OcrArgs): Promise<string> {
  const file = await resolveReadableFile(args.file_path);
  const info = await stat(file);

  if (info.size > MAX_OCR_BYTES) {
    throw new Error(
      `File too large: ${humanBytes(info.size)}. OCR accepts up to 100 MiB.`
    );
  }

  const form = new FormData();
  const blob = await openAsBlob(file).catch(async () => null);
  if (!blob) {
    throw new Error(`Could not read file as a blob: ${file}`);
  }
  form.append("file", blob, basename(file));
  form.append("purpose", args.purpose ?? "text_recognition");

  // The documented total budget is 180s; leave a little headroom for transport.
  const data = await postMultipart<OcrResponse>("/ocr", form, 200_000);
  const pages = Array.isArray(data.pages) ? data.pages : [];

  if (pages.length === 0) {
    return `pages: ${data.page_count ?? 0}\n\n(no text recognized)`;
  }

  const blocks = pages.map((page, index) => {
    const number = page.index ?? index;
    const suffix = page.finish_reason === "length" ? " (incomplete)" : "";
    return `--- page ${number}${suffix} ---\n${page.text ?? ""}`;
  });

  const capped = truncateText(blocks.join("\n\n"));
  const header = `pages: ${data.page_count ?? pages.length}`;
  if (!capped.truncated) return `${header}\n\n${capped.text}`;

  return `${header}\n\n${capped.text}\n\n[truncated: showing ${capped.text.length} of ${capped.totalChars} characters]`;
}
