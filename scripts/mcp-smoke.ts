import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Protocol-level smoke test: spawns the built server over stdio,
 * lists its tools, then calls deepseek_search once.
 */
async function main(): Promise<void> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.error("DEEPSEEK_API_KEY is required for the MCP smoke test.");
    process.exit(1);
  }

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined)
  ) as Record<string, string>;
  env.DEEPSEEK_API_KEY = key;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("dist/src/index.js")],
    env,
    stderr: "inherit",
  });

  const client = new Client({ name: "deepseek-tools-mcp-smoke", version: "0.0.0" });
  await client.connect(transport);

  try {
    const listed = await client.listTools();
    console.log("tools:", listed.tools.map((tool) => tool.name).join(", "));

    const result = await client.callTool({
      name: "deepseek_search",
      arguments: { query: "DeepSeek tools MCP", count: 1 },
    });
    console.log("search content:", JSON.stringify(result.content).slice(0, 500));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("mcp smoke test failed:", error);
  process.exit(1);
});
