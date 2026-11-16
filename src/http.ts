import { SERVER_NAME, SERVER_VERSION, apiKey, baseUrl } from "./config.js";

/** Error raised for any non-2xx response from the DeepSeek tools API. */
export class DeepSeekApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, message: string, body = "") {
    super(message);
    this.name = "DeepSeekApiError";
    this.status = status;
    this.body = body;
  }
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "User-Agent": `${SERVER_NAME}/${SERVER_VERSION}`,
  };
}

async function toApiError(response: Response): Promise<DeepSeekApiError> {
  const raw = await response.text().catch(() => "");
  let message = `DeepSeek API returned HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const candidate =
      typeof parsed.error === "string"
        ? parsed.error
        : (parsed.error?.message ?? parsed.message);
    if (typeof candidate === "string" && candidate.trim()) {
      message = `DeepSeek API error (${response.status}): ${candidate.trim()}`;
    }
  } catch {
    // Non-JSON error body: keep the generic message and attach a short excerpt.
    const excerpt = raw.trim().slice(0, 300);
    if (excerpt) message += `: ${excerpt}`;
  }

  return new DeepSeekApiError(response.status, message, raw.slice(0, 2000));
}

/** POST a JSON body and parse a JSON response. */
export async function postJson<T>(
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) throw await toApiError(response);

  // OCR keeps the connection alive with leading newlines before the JSON body.
  const text = (await response.text()).trim();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** POST a multipart form (OCR / ASR). Do not set Content-Type: fetch adds the boundary. */
export async function postMultipart<T>(
  path: string,
  form: FormData,
  timeoutMs: number
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) throw await toApiError(response);

  const text = (await response.text()).trim();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** POST JSON and read a binary response (TTS). */
export async function postBinary(
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<{ data: Buffer; contentType: string }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) throw await toApiError(response);

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
