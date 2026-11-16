# deepseek-tools-mcp

**Unofficial** MCP server that exposes DeepSeek's standalone tools APIs as MCP tools:
**Web Search, Fetch, OCR, ASR and TTS**.

> 非官方项目，与 DeepSeek 无隶属关系。DeepSeek 及其 API 的条款与定价以官方文档为准。
> This project is not affiliated with DeepSeek. Use it under DeepSeek's own terms and pricing.

---

## Why this exists

DeepSeek opened its standalone tools API in 2026 and added OCR / ASR / TTS shortly after. Those
are plain REST endpoints, which makes them a natural fit for MCP — but most existing MCP wrappers
only cover Search and Fetch, and the in-conversation server tools (`deepseek_web_search`,
`deepseek_read_url`) cannot be reused outside a model round-trip.

This server wraps the **standalone APIs** so any MCP client can call them directly:

| MCP tool | DeepSeek endpoint | Notes |
|---|---|---|
| `deepseek_search` | `POST /v1/tools/search` | Query operators, `count` 1–50, `ori_question` hint |
| `deepseek_fetch` | `POST /v1/tools/fetch` | Page to Markdown, offset paging for long pages |
| `deepseek_ocr` | `POST /v1/tools/ocr` | PDF / Word / PowerPoint / images, per-page text |
| `deepseek_asr` | `POST /v1/tools/asr` | WAV (16-bit PCM) or Ogg Opus, ≤8 MiB / ≤120 s |
| `deepseek_tts` | `POST /v1/tools/tts` | wav / pcm, written to a local file |

It deliberately does **not** wrap `deepseek_web_search` or `deepseek_read_url`: those are
server-side tools that require a model round-trip, and the standalone Search/Fetch APIs cover the
same ground more cheaply.

## Requirements

- Node.js **>= 20**
- A DeepSeek API key with access to the tools API

## Quick start

```bash
DEEPSEEK_API_KEY=sk-... npx -y deepseek-tools-mcp
```

From source:

```bash
git clone https://github.com/wuzhechen/deepseek-tools-mcp.git
cd deepseek-tools-mcp
npm install
npm run build
DEEPSEEK_API_KEY=sk-... node dist/src/index.js
```

The server speaks MCP over **stdio**; stdout is the protocol channel, logs go to stderr.

## Client configuration

### Claude Code

```bash
claude mcp add deepseek-tools \
  --env DEEPSEEK_API_KEY=sk-... \
  -- npx -y deepseek-tools-mcp
```

### CC Switch (and dsh)

Add a new stdio MCP server:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "deepseek-tools-mcp"],
  "env": { "DEEPSEEK_API_KEY": "sk-..." }
}
```

CC Switch writes MCP entries into each app it manages — for DeepSeek Harness that means
`~/.dsh/profiles/<profile>/cordis.patch.yml` as a `@deepseek-ai/dsh-mcp-client` entry, so the
same tools become available to Claude Code and dsh.

### Generic MCP config

See [`examples/mcp.json`](examples/mcp.json).

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | — (required) | DeepSeek API key. Read from the server process environment only. |
| `DEEPSEEK_TOOLS_BASE_URL` | `https://api.deepseek.com/v1/tools` | Override for proxies or private deployments. |
| `DEEPSEEK_TOOLS_MAX_OUTPUT_CHARS` | `20000` | Cap on characters returned per call (search / fetch / ocr). Minimum 1000. |
| `DEEPSEEK_TOOLS_ALLOWED_DIRS` | unset (any path) | Optional `:`-separated allowlist for local file reads (OCR / ASR). |

## Tool reference

### `deepseek_search`

| Input | Type | Description |
|---|---|---|
| `query` | string, 1–128 chars | Supports `site:` / `-site:`, `-term`, `"exact phrase"`, `lang:`, `after:`, `before:`. |
| `count` | int, 1–50, default 10 | Number of results. |
| `ori_question` | string, ≤128 chars | Original user question, improves recall. |
| `need_content` | boolean, default false | Ask for page content too (heavier). |
| `localization` | string | Optional locale/IP hint. |

Returns numbered results with title, URL, summary/snippet, date and authority.

### `deepseek_fetch`

| Input | Type | Description |
|---|---|---|
| `url` | string | http/https only, ≤8192 chars. |
| `offset` | int, default 0 | Character offset for paging. |
| `max_chars` | int, 1000–50000, default 20000 | Chunk size per call. |

Returns `URL`, the character range and the Markdown content. When the page is longer, the header
includes the next offset.

### `deepseek_ocr`

| Input | Type | Description |
|---|---|---|
| `file_path` | string | PDF, doc/docx, ppt/pptx, png/jpeg/webp/gif/bmp/tiff. Max 100 MiB, 1000 pages. |
| `purpose` | `text_recognition` (default) or `rich_layout_recognition` | `text_recognition` extracts text directly from text-only Office files; `rich_layout_recognition` OCRs every page. |

Returns page-count and `--- page N ---` blocks. The API budget is 180 s end-to-end; this tool waits
up to 200 s.

### `deepseek_asr`

| Input | Type | Description |
|---|---|---|
| `file_path` | string | 16-bit PCM WAV or Ogg Opus. Max 8 MiB and 120 s. Stereo uses the left channel. |

Returns `text` and `duration_ms`.

### `deepseek_tts`

| Input | Type | Description |
|---|---|---|
| `text` | string | Non-empty. Up to 10000 billed characters (Chinese counts as 2) and a 64 KiB request body. |
| `voice_id` | `stella` (default) / `tide` | Female / male voice. |
| `format` | `wav` (default) / `pcm` | `pcm` is raw 24 kHz, 16-bit, mono. |
| `filter_markdown` | boolean, default true | Strip Markdown before synthesis. |
| `output_path` | string | Optional. Defaults to `~/.cache/deepseek-tools-mcp/tts-<timestamp>.<format>`. |

Audio is written to a file and the tool returns the path, format, content type and byte size.

## Limits and pricing

Limits below are enforced by the API; see the official docs for the current values.

- **Search / Fetch**: per-request pricing (about ¥5 per 1000 successful calls), rate limited per account.
- **OCR**: max 100 MiB, 1000 pages, 180 s total; about ¥1.5 per 1000 pages.
- **ASR**: max 8 MiB, 120 s; priced per audio hour.
- **TTS**: max 10000 billed chars and 64 KiB body; priced per character.

Only successful requests are billed. Verify prices and quotas in the
[official guide](https://api-docs.deepseek.com/zh-cn/guides/search/) before relying on them.

## Security notes

- The API key is read from the environment and never logged or written to disk.
- OCR/ASR read **only the file path you pass**; set `DEEPSEEK_TOOLS_ALLOWED_DIRS` to confine reads.
- TTS writes only to `output_path` (or the cache directory) and creates the parent directory.
- No shell execution, no network access beyond the configured `DEEPSEEK_TOOLS_BASE_URL`.
- Responses are capped by `DEEPSEEK_TOOLS_MAX_OUTPUT_CHARS` to protect the model's context.

## Development

```bash
npm install
npm run build
npm test                 # unit tests (mocked fetch)
npm run smoke            # live API calls; requires DEEPSEEK_API_KEY
```

Live OCR / ASR checks:

```bash
SMOKE_OCR_FILE=/path/to/file.pdf \
SMOKE_ASR_FILE=/path/to/audio.wav \
DEEPSEEK_API_KEY=sk-... npm run smoke
```

## License

MIT
