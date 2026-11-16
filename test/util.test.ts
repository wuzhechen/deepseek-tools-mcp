import assert from "node:assert/strict";
import { homedir } from "node:os";
import path from "node:path";
import test from "node:test";
import { expandHome, truncateText } from "../src/util.js";

test("truncateText leaves short text untouched", () => {
  const result = truncateText("hello", 100);
  assert.equal(result.text, "hello");
  assert.equal(result.truncated, false);
  assert.equal(result.totalChars, 5);
});

test("truncateText caps long text and reports the original size", () => {
  const result = truncateText("abcdefghij", 4);
  assert.equal(result.text, "abcd");
  assert.equal(result.truncated, true);
  assert.equal(result.totalChars, 10);
});

test("expandHome expands only a leading tilde", () => {
  assert.equal(expandHome("~"), homedir());
  assert.equal(expandHome("~/notes/a.txt"), path.join(homedir(), "notes/a.txt"));
  assert.equal(expandHome("/tmp/~not-home"), "/tmp/~not-home");
  assert.equal(expandHome("relative/path"), "relative/path");
});
