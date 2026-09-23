import { randomUUID } from "node:crypto";
import type { ProviderAdapter } from "../base";
import type { AdapterEvent, CodexParsedRequest, CodexProviderConfig } from "../../types";
import {
  CHATGPT_WEB_BACKEND_MODEL,
  CHATGPT_WEB_RELAY_BACKEND_MODEL,
} from "../../chatgpt-web-models";
import { ChatGptWebAdapterError } from "./adapter-error";
import { ChatGptBrowserWorker } from "./browser-worker";
import { createChatGptStructuredOutputValidator } from "./output-validation";
import { compileChatGptWebRelayPrompt } from "./relay-prompt";
import { parseChatGptWebRelayEnvelope } from "./relay-protocol";
import {
  CHATGPT_WEB_ADAPTER_HEARTBEAT_MS,
  createChatGptWebAdapter as createLegacyChatGptWebAdapter,
} from "./legacy-index";

export * from "./legacy-index";

function relayCapabilities(provider: CodexProviderConfig) {
  return {
    localToolsEnabled: false,
    solAvailable: provider.chatgptWeb?.solAvailable !== false,
    extraHighAvailable: provider.chatgptWeb?.extraHighAvailable === true,
    proAvailable: provider.chatgptWeb?.proAvailable === true,
  };
}

function emitRelayError(error: unknown, emit: (event: AdapterEvent) => void): void {
  if (error instanceof ChatGptWebAdapterError) {
    emit({
      type: "error",
      message: error.message,
      status: error.status,
      errorType: error.errorType,
      code: error.code,
      retryable: error.retryable,
    });
    return;
  }
  emit({
    type: "error",
    message: error instanceof Error ? error.message : String(error),
    status: 502,
    errorType: "server_error",
    code: "relay_protocol_error",
    retryable: false,
  });
}

async function runRelayTurn(
  provider: CodexProviderConfig,
  parsed: CodexParsedRequest,
  incoming: { headers: Headers; abortSignal?: AbortSignal },
  emit: (event: AdapterEvent) => void,
): Promise<void> {
  if (provider.chatgptWeb?.browserInteractionMode === "manual") {
    emit({
      type: "error",
      message: "ChatGPT Web Relay requires automatic browser interaction because it reads the structured relay envelope from ChatGPT.",
      status: 409,
      errorType: "invalid_request_error",
      code: "relay_requires_automatic_browser",
      retryable: false,
    });
    return;
  }

  const capabilities = relayCapabilities(provider);
  if (!capabilities.solAvailable) {
    emit({
      type: "error",
      message: "ChatGPT Web Relay currently requires an account with the Sol model selector.",
      status: 409,
      errorType: "invalid_request_error",
      code: "relay_model_unavailable",
      retryable: false,
    });
    return;
  }

  const relayProvider: CodexProviderConfig = {
    ...provider,
    chatgptWeb: {
      ...provider.chatgptWeb,
      browserInteractionMode: "automatic",
      localToolsEnabled: false,
      autoApproveToolCalls: false,
    },
  };
  const worker = ChatGptBrowserWorker.forProvider(relayProvider);
  const validateFinal = parsed._compactionRequest
    ? undefined
    : createChatGptStructuredOutputValidator(parsed.options.outputFormat);
  const traceId = `relay_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const timer = setInterval(() => emit({ type: "heartbeat" }), CHATGPT_WEB_ADAPTER_HEARTBEAT_MS);
  timer.unref?.();

  try {
    emit({ type: "heartbeat" });
    const answer = await worker.run({
      traceId,
      modelId: CHATGPT_WEB_BACKEND_MODEL,
      reasoning: parsed.options.reasoning,
      modelFamily: parsed._chatgptModelFamily ?? "5.6",
      capabilities,
      prepare: async () => ({
        ...compileChatGptWebRelayPrompt(parsed, capabilities),
        release: () => {},
      }),
      abortSignal: incoming.abortSignal,
      ...(parsed._compactionRequest ? { compaction: true } : {}),
      onTextDelta: () => {},
    });

    const envelope = parseChatGptWebRelayEnvelope(answer, parsed);
    if (envelope.type === "tool_call") {
      const callId = `call_relay_${randomUUID()}`;
      emit({ type: "tool_call_start", id: callId, name: envelope.tool });
      emit({
        type: "tool_call_delta",
        arguments: "input" in envelope
          ? JSON.stringify({ input: envelope.input })
          : JSON.stringify(envelope.arguments),
      });
      emit({ type: "tool_call_end" });
      emit({ type: "done", stopReason: "tool_use", endTurn: false });
      return;
    }

    validateFinal?.(envelope.answer);
    emit({ type: "text_delta", text: envelope.answer, phase: "final_answer" });
    emit({ type: "done", stopReason: "stop", endTurn: true });
  } catch (error) {
    if (incoming.abortSignal?.aborted
      || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    emitRelayError(error, emit);
  } finally {
    clearInterval(timer);
  }
}

export function createChatGptWebAdapter(
  provider: CodexProviderConfig,
  dependencies: Parameters<typeof createLegacyChatGptWebAdapter>[1] = {},
): ProviderAdapter {
  const legacy = createLegacyChatGptWebAdapter(provider, dependencies);
  return {
    ...legacy,
    async runTurn(parsed, incoming, emit) {
      if (parsed.modelId !== CHATGPT_WEB_RELAY_BACKEND_MODEL) {
        return legacy.runTurn!(parsed, incoming, emit);
      }
      return runRelayTurn(provider, parsed, incoming, emit);
    },
  };
}
