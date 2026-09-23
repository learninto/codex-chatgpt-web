import * as legacy from "./chatgpt-web-models-legacy";

export * from "./chatgpt-web-models-legacy";

export const CHATGPT_WEB_RELAY_BACKEND_MODEL = "chatgpt-web-relay" as const;
export const CHATGPT_WEB_RELAY_MODEL_ROUTE = {
  slug: "chatgpt-web/relay",
  displayName: "GPT-5.6 Sol Relay (Web)",
  description: "ChatGPT Plus Web reasoning with local Codex tools relayed as validated structured calls; no ChatGPT custom connector required.",
  interactionMode: "automatic",
  backendModel: CHATGPT_WEB_RELAY_BACKEND_MODEL,
  modelFamily: "5.6",
  codexEffort: "high",
  adapterEffort: "high",
  supportedCodexEfforts: ["medium", "high", "xhigh"],
  requiresPro: false,
} as unknown as legacy.ChatGptWebAutomaticModelRoute;

export const CHATGPT_WEB_MODEL_ROUTES: readonly legacy.ChatGptWebAutomaticModelRoute[] = [
  ...legacy.CHATGPT_WEB_MODEL_ROUTES,
  CHATGPT_WEB_RELAY_MODEL_ROUTE,
];

function relayEffort(
  capabilities: legacy.ChatGptWebAccountCapabilities,
  reasoning?: string,
): legacy.ChatGptWebAutomaticModelRoute {
  const effort = reasoning ?? "high";
  const allowed = capabilities.extraHighAvailable === true
    ? ["medium", "high", "xhigh"]
    : ["medium", "high"];
  if (!allowed.includes(effort)) {
    throw new Error(`${CHATGPT_WEB_RELAY_MODEL_ROUTE.displayName} does not support effort ${JSON.stringify(effort)} for this account`);
  }
  return {
    ...CHATGPT_WEB_RELAY_MODEL_ROUTE,
    codexEffort: effort as legacy.ChatGptWebCodexEffort,
    adapterEffort: effort as legacy.ChatGptWebAdapterEffort,
  } as legacy.ChatGptWebAutomaticModelRoute;
}

export function availableChatGptWebModelRoutes(
  capabilities: legacy.ChatGptWebAccountCapabilities,
  includeLegacy = false,
): readonly legacy.ChatGptWebModelRoute[] {
  const routes = legacy.availableChatGptWebModelRoutes(capabilities, includeLegacy);
  if (capabilities.browserInteractionMode === "manual" || !capabilities.solAvailable) return routes;
  return [...routes, relayEffort(capabilities)];
}

export function requireChatGptWebModelRoute(
  modelId: string,
  capabilities: legacy.ChatGptWebAccountCapabilities,
  reasoning?: string,
): legacy.ChatGptWebModelRoute {
  if (modelId !== CHATGPT_WEB_RELAY_MODEL_ROUTE.slug) {
    return legacy.requireChatGptWebModelRoute(modelId, capabilities, reasoning);
  }
  if (capabilities.browserInteractionMode === "manual") {
    throw new Error(`${CHATGPT_WEB_RELAY_MODEL_ROUTE.displayName} requires automatic browser interaction`);
  }
  if (!capabilities.solAvailable) {
    throw new Error(`${CHATGPT_WEB_RELAY_MODEL_ROUTE.displayName} is not available for this Luna-only account`);
  }
  return relayEffort(capabilities, reasoning);
}

export function chatGptWebRouteEfforts(
  route: legacy.ChatGptWebModelRoute,
  capabilities: legacy.ChatGptWebAccountCapabilities,
): readonly legacy.ChatGptWebCodexEffort[] {
  if (route.slug !== CHATGPT_WEB_RELAY_MODEL_ROUTE.slug) {
    return legacy.chatGptWebRouteEfforts(route, capabilities);
  }
  return (CHATGPT_WEB_RELAY_MODEL_ROUTE.supportedCodexEfforts ?? ["high"])
    .filter(effort => effort !== "xhigh" || capabilities.extraHighAvailable === true) as readonly legacy.ChatGptWebCodexEffort[];
}

export function resolveChatGptWebContextLimits(
  backendModel: legacy.ChatGptWebBackendModel | typeof CHATGPT_WEB_RELAY_BACKEND_MODEL,
  effort: legacy.ChatGptWebAdapterEffort,
  capabilities: legacy.ChatGptWebAccountCapabilities,
): legacy.ChatGptWebContextLimits {
  return legacy.resolveChatGptWebContextLimits(
    backendModel === CHATGPT_WEB_RELAY_BACKEND_MODEL ? legacy.CHATGPT_WEB_BACKEND_MODEL : backendModel,
    effort,
    capabilities,
  );
}

export function resolveChatGptWebTransportLimits(
  backendModel: legacy.ChatGptWebBackendModel | typeof CHATGPT_WEB_RELAY_BACKEND_MODEL,
  effort: legacy.ChatGptWebAdapterEffort,
  capabilities: legacy.ChatGptWebAccountCapabilities,
): legacy.ChatGptWebTransportLimits {
  return legacy.resolveChatGptWebTransportLimits(
    backendModel === CHATGPT_WEB_RELAY_BACKEND_MODEL ? legacy.CHATGPT_WEB_BACKEND_MODEL : backendModel,
    effort,
    capabilities,
  );
}

export function resolveChatGptWebMessageTokenBudget(
  backendModel: typeof legacy.CHATGPT_WEB_BACKEND_MODEL | typeof CHATGPT_WEB_RELAY_BACKEND_MODEL,
  effort: legacy.ChatGptWebAdapterEffort,
  capabilities: legacy.ChatGptWebAccountCapabilities,
  imageTokens = 0,
): number {
  return legacy.resolveChatGptWebMessageTokenBudget(
    backendModel === CHATGPT_WEB_RELAY_BACKEND_MODEL ? legacy.CHATGPT_WEB_BACKEND_MODEL : backendModel,
    effort,
    capabilities,
    imageTokens,
  );
}
