import type { CodexParsedRequest, CodexTool, CodexToolChoice } from "../../types";
import { namespacedToolName } from "../../types";

export const CHATGPT_WEB_RELAY_MAX_ENVELOPE_BYTES = 1_048_576;

export type ChatGptWebRelayEnvelope =
  | { type: "tool_call"; tool: string; arguments: Record<string, unknown> }
  | { type: "tool_call"; tool: string; input: string }
  | { type: "final"; answer: string };

export interface ChatGptWebRelayToolDescriptor {
  wire_name: string;
  description: string;
  parameters: Record<string, unknown>;
  freeform: boolean;
  strict: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

export function chatGptWebRelayToolCatalog(tools: readonly CodexTool[] = []): ChatGptWebRelayToolDescriptor[] {
  return tools
    .filter(tool => tool.toolSearch !== true)
    .map(tool => ({
      wire_name: namespacedToolName(tool.namespace, tool.name),
      description: tool.description,
      parameters: tool.parameters,
      freeform: tool.freeform === true,
      strict: tool.strict === true,
    }));
}

function allowedByToolChoice(tool: string, choice: CodexToolChoice | undefined): boolean {
  if (choice === undefined || choice === "auto" || choice === "required") return true;
  if (choice === "none") return false;
  if ("name" in choice) return choice.name === tool;
  return choice.allowedTools.includes(tool);
}

function finalAllowed(choice: CodexToolChoice | undefined): boolean {
  if (choice === "required") return false;
  if (choice && typeof choice === "object" && "allowedTools" in choice && choice.mode === "required") return false;
  return true;
}

export function parseChatGptWebRelayEnvelope(
  text: string,
  parsed: Pick<CodexParsedRequest, "context" | "options">,
): ChatGptWebRelayEnvelope {
  if (Buffer.byteLength(text, "utf8") > CHATGPT_WEB_RELAY_MAX_ENVELOPE_BYTES) {
    throw new Error("ChatGPT Relay response exceeded the maximum envelope size");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("ChatGPT Relay must return exactly one JSON envelope without Markdown fences or extra prose");
  }
  if (!isRecord(decoded) || typeof decoded.type !== "string") {
    throw new Error("ChatGPT Relay returned an invalid envelope");
  }

  if (decoded.type === "final") {
    if (!exactKeys(decoded, ["type", "answer"]) || typeof decoded.answer !== "string" || !decoded.answer.trim()) {
      throw new Error("ChatGPT Relay final envelope must contain only a non-empty string answer");
    }
    if (!finalAllowed(parsed.options.toolChoice)) {
      throw new Error("ChatGPT Relay returned a final answer while Codex required a tool call");
    }
    return { type: "final", answer: decoded.answer };
  }

  if (decoded.type !== "tool_call" || typeof decoded.tool !== "string" || !decoded.tool) {
    throw new Error("ChatGPT Relay envelope type must be tool_call or final");
  }
  if (!allowedByToolChoice(decoded.tool, parsed.options.toolChoice)) {
    throw new Error(`ChatGPT Relay requested disallowed tool ${JSON.stringify(decoded.tool)}`);
  }
  const descriptor = chatGptWebRelayToolCatalog(parsed.context.tools)
    .find(tool => tool.wire_name === decoded.tool);
  if (!descriptor) {
    throw new Error(`ChatGPT Relay requested a tool that Codex did not advertise: ${decoded.tool}`);
  }

  if (descriptor.freeform) {
    if (!exactKeys(decoded, ["type", "tool", "input"]) || typeof decoded.input !== "string") {
      throw new Error(`ChatGPT Relay freeform tool ${decoded.tool} requires exactly one string input`);
    }
    return { type: "tool_call", tool: decoded.tool, input: decoded.input };
  }

  if (!exactKeys(decoded, ["type", "tool", "arguments"]) || !isRecord(decoded.arguments)) {
    throw new Error(`ChatGPT Relay tool ${decoded.tool} requires exactly one arguments object`);
  }
  return { type: "tool_call", tool: decoded.tool, arguments: decoded.arguments };
}
