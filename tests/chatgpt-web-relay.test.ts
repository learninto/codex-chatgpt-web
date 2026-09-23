import { describe, expect, test } from "bun:test";
import { compileChatGptWebRelayPrompt } from "../src/adapters/chatgpt-web/relay-prompt";
import {
  chatGptWebRelayToolCatalog,
  parseChatGptWebRelayEnvelope,
} from "../src/adapters/chatgpt-web/relay-protocol";
import type { CodexParsedRequest } from "../src/types";

function request(toolChoice: CodexParsedRequest["options"]["toolChoice"] = "auto"): CodexParsedRequest {
  return {
    modelId: "chatgpt-web-relay",
    context: {
      systemPrompt: ["Work carefully."],
      messages: [{ role: "user", content: "Inspect package.json", timestamp: 1 }],
      tools: [
        {
          name: "read_file",
          description: "Read one file",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
            additionalProperties: false,
          },
          strict: true,
        },
        {
          name: "apply_patch",
          description: "Apply a patch",
          parameters: {},
          freeform: true,
        },
        {
          name: "lookup",
          namespace: "mcp__docs",
          description: "Look up documentation",
          parameters: { type: "object" },
        },
      ],
    },
    stream: true,
    options: { reasoning: "high", toolChoice },
  };
}

describe("ChatGPT Web structured relay protocol", () => {
  test("publishes only the native Codex tool catalog using wire names", () => {
    expect(chatGptWebRelayToolCatalog(request().context.tools)).toEqual([
      expect.objectContaining({ wire_name: "read_file", freeform: false, strict: true }),
      expect.objectContaining({ wire_name: "apply_patch", freeform: true }),
      expect.objectContaining({ wire_name: "mcp__docs__lookup", freeform: false }),
    ]);
  });

  test("accepts one schema tool call and rejects invented tools", () => {
    expect(parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "tool_call", tool: "read_file", arguments: { path: "package.json" } }),
      request(),
    )).toEqual({ type: "tool_call", tool: "read_file", arguments: { path: "package.json" } });
    expect(() => parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "tool_call", tool: "shell_magic", arguments: {} }),
      request(),
    )).toThrow("did not advertise");
  });

  test("keeps freeform tools separate from schema arguments", () => {
    expect(parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "tool_call", tool: "apply_patch", input: "*** Begin Patch" }),
      request(),
    )).toEqual({ type: "tool_call", tool: "apply_patch", input: "*** Begin Patch" });
    expect(() => parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "tool_call", tool: "apply_patch", arguments: { patch: "x" } }),
      request(),
    )).toThrow("requires exactly one string input");
  });

  test("enforces Codex tool-choice policy at the relay boundary", () => {
    expect(() => parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "tool_call", tool: "read_file", arguments: { path: "x" } }),
      request("none"),
    )).toThrow("disallowed tool");
    expect(() => parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "final", answer: "done" }),
      request("required"),
    )).toThrow("required a tool call");
  });

  test("rejects markdown wrappers and extra envelope keys", () => {
    expect(() => parseChatGptWebRelayEnvelope(
      "```json\n{\"type\":\"final\",\"answer\":\"done\"}\n```",
      request(),
    )).toThrow("exactly one JSON envelope");
    expect(() => parseChatGptWebRelayEnvelope(
      JSON.stringify({ type: "final", answer: "done", hidden: "extra" }),
      request(),
    )).toThrow("must contain only");
  });

  test("prompt states the local security boundary and exact transport envelopes", () => {
    const compiled = compileChatGptWebRelayPrompt(request(), {
      localToolsEnabled: false,
      solAvailable: true,
      extraHighAvailable: false,
      proAvailable: false,
    });
    expect(compiled.text).toContain("You do not have direct access to the user's local computer");
    expect(compiled.text).toContain("outer Codex runtime validates the envelope and executes the tool under its own permissions and safety policy");
    expect(compiled.text).toContain('"type":"tool_call"');
    expect(compiled.text).toContain('"type":"final"');
    expect(compiled.text).toContain('"wire_name":"read_file"');
  });
});
