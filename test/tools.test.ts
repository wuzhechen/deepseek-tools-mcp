import assert from "node:assert/strict";
import test from "node:test";

process.env.DEEPSEEK_API_KEY = "test-key";

const realFetch = globalThis.fetch;

function mockJson(payload: unknown, status = 200): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

test.after(() => {
  globalThis.fetch = realFetch;
});

test("runSearch formats results with title, URL, excerpt and meta", async (t) => {
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  mockJson({
    results: [
      {
        title: "Example Result",
        url: "https://example.com/a",
        summary: "A short summary",
        date: "2026-01-01",
        authority: 3,
      },
    ],
  });

  const { runSearch } = await import("../src/tools/search.js");
  const output = await runSearch({ query: "example" });

  assert.match(output, /1\. Example Result/);
  assert.match(output, /https:\/\/example\.com\/a/);
  assert.match(output, /A short summary/);
  assert.match(output, /date: 2026-01-01/);
  assert.match(output, /authority: 3/);
});

test("runSearch reports an empty result set", async (t) => {
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  mockJson({ results: [] });

  const { runSearch } = await import("../src/tools/search.js");
  assert.equal(await runSearch({ query: "nothing" }), "No results found.");
});

test("API errors surface status and message", async (t) => {
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  mockJson({ error: { message: "invalid api key" } }, 401);

  const { runSearch } = await import("../src/tools/search.js");
  await assert.rejects(
    () => runSearch({ query: "example" }),
    /DeepSeek API error \(401\): invalid api key/
  );
});

test("runFetch pages through long content", async (t) => {
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  mockJson({ content: "abcdefghij" });

  const { runFetch } = await import("../src/tools/fetch.js");
  const output = await runFetch({
    url: "https://example.com",
    offset: 2,
    max_chars: 1000,
  });

  assert.match(output, /chars: 2-10 of 10/);
  assert.match(output, /cdefghij/);
});

test("runTts rejects an oversized request body before calling the API", async () => {
  const { runTts } = await import("../src/tools/tts.js");
  await assert.rejects(
    () => runTts({ text: "x".repeat(70 * 1024) }),
    /at most 64 KiB/
  );
});
