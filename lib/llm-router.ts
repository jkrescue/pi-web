export type RouterMode = "manual" | "auto";
export type RouterProfileId = "cost-saver" | "balanced" | "best-quality" | string;
export type RouterTier = "simple" | "standard" | "complex" | "reasoning" | "vision";
export type RouterCostClass = "free" | "paid" | "unknown";
export type RouterDeployment = "local" | "cloud" | "unknown";
export type RouterCapability = "basic" | "standard" | "strong" | "vision";
export type RouterPolicy = "local-first" | "balanced" | "quality-first";

export interface RouterModelRef {
  provider: string;
  modelId: string;
}

export interface RouterModel extends RouterModelRef {
  name: string;
  input?: string[];
  api?: string;
  baseUrl?: string;
}

export interface RouterModelMetadata {
  costClass?: RouterCostClass;
  deployment?: RouterDeployment;
  capability?: RouterCapability;
  priority?: number;
}

export interface RouterProfile {
  label: string;
  description?: string;
  policy?: RouterPolicy;
  tiers?: Partial<Record<RouterTier, RouterModelRef>>;
  upgradeTiers?: RouterTier[];
  preferences?: Partial<Record<RouterTier, string[]>>;
}

export interface RouterConfig {
  version: 1;
  enabled: boolean;
  defaultProfile: RouterProfileId;
  models?: Record<string, RouterModelMetadata>;
  profiles: Record<string, RouterProfile>;
}

export interface RouterRequest {
  cwd: string;
  message: string;
  hasImages?: boolean;
  currentModel?: RouterModelRef | null;
  profile?: RouterProfileId;
  availableModels: RouterModel[];
  contextTokens?: number | null;
}

export interface RouterDecision extends RouterModelRef {
  tier: RouterTier;
  profile: RouterProfileId;
  reason: string;
  confidence: number;
  matchedSignals: string[];
  changed: boolean;
  fallback: boolean;
  costClass: RouterCostClass;
  deployment: RouterDeployment;
  capability: RouterCapability;
  upgradeModel?: RouterModelRef & {
    costClass: RouterCostClass;
    deployment: RouterDeployment;
    capability: RouterCapability;
    reason: string;
  };
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  version: 1,
  enabled: true,
  defaultProfile: "balanced",
  models: {},
  profiles: {
    "cost-saver": {
      label: "Cost saver",
      description: "Prefer local/free models first; upgrade to paid cloud only after objective failure.",
      policy: "local-first",
      upgradeTiers: ["complex", "reasoning"],
      preferences: {
        simple: ["qwen", "local", "mini", "flash", "haiku", "small", "lite"],
        standard: ["qwen", "local", "mini", "flash", "haiku"],
        complex: ["qwen", "local", "kimi", "sonnet", "gpt-4.1", "gpt-4o"],
        reasoning: ["qwen", "local", "kimi", "reasoning", "o1", "o3", "opus"],
        vision: ["kimi", "vision", "gpt-4o", "gemini", "claude", "multimodal"],
      },
    },
    balanced: {
      label: "Balanced",
      description: "Use local/free models for simple and standard work; allow cloud upgrade for complex work.",
      policy: "balanced",
      upgradeTiers: ["complex"],
      preferences: {
        simple: ["qwen", "local", "mini", "flash", "haiku", "lite", "small"],
        standard: ["qwen", "local", "kimi", "sonnet", "gpt-4.1", "gpt-4o"],
        complex: ["qwen", "local", "kimi", "sonnet", "opus", "gpt-5", "gpt-4.1"],
        reasoning: ["kimi", "reasoning", "o3", "o1", "opus", "sonnet", "gpt-5"],
        vision: ["kimi", "gpt-4o", "gemini", "claude", "vision", "multimodal"],
      },
    },
    "best-quality": {
      label: "Best quality",
      description: "Favor the strongest cloud model for standard, complex, and reasoning work.",
      policy: "quality-first",
      preferences: {
        simple: ["qwen", "local", "kimi", "sonnet", "gpt-4.1", "gpt-4o"],
        standard: ["kimi", "opus", "sonnet", "gpt-5", "gpt-4.1"],
        complex: ["kimi", "opus", "sonnet", "gpt-5", "o3"],
        reasoning: ["kimi", "opus", "o3", "o1", "reasoning", "gpt-5"],
        vision: ["kimi", "gpt-4o", "gemini", "claude", "opus", "vision"],
      },
    },
  },
};

const ROUTER_TIERS: RouterTier[] = ["simple", "standard", "complex", "reasoning", "vision"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeModelRef(value: unknown): RouterModelRef | undefined {
  if (!isRecord(value)) return undefined;
  const provider = typeof value.provider === "string" ? value.provider.trim() : "";
  const modelId = typeof value.modelId === "string" ? value.modelId.trim() : "";
  if (!provider || !modelId) return undefined;
  return { provider, modelId };
}

function normalizeProfile(value: unknown, fallback: RouterProfile): RouterProfile {
  if (!isRecord(value)) return fallback;
  const tiers: Partial<Record<RouterTier, RouterModelRef>> = {};
  const rawTiers = isRecord(value.tiers) ? value.tiers : {};
  for (const tier of ROUTER_TIERS) {
    const ref = normalizeModelRef(rawTiers[tier]);
    if (ref) tiers[tier] = ref;
  }
  const preferences: Partial<Record<RouterTier, string[]>> = {};
  const rawPreferences = isRecord(value.preferences) ? value.preferences : {};
  for (const tier of ROUTER_TIERS) {
    const list = rawPreferences[tier];
    if (Array.isArray(list)) {
      preferences[tier] = list.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  }
  return {
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : fallback.label,
    description: typeof value.description === "string" ? value.description : fallback.description,
    policy: value.policy === "local-first" || value.policy === "balanced" || value.policy === "quality-first" ? value.policy : fallback.policy,
    tiers: Object.keys(tiers).length ? tiers : fallback.tiers,
    upgradeTiers: Array.isArray(value.upgradeTiers)
      ? value.upgradeTiers.filter((tier): tier is RouterTier => ROUTER_TIERS.includes(tier as RouterTier))
      : fallback.upgradeTiers,
    preferences: Object.keys(preferences).length ? preferences : fallback.preferences,
  };
}

function normalizeMetadata(value: unknown): RouterModelMetadata | undefined {
  if (!isRecord(value)) return undefined;
  return {
    costClass: value.costClass === "free" || value.costClass === "paid" || value.costClass === "unknown" ? value.costClass : undefined,
    deployment: value.deployment === "local" || value.deployment === "cloud" || value.deployment === "unknown" ? value.deployment : undefined,
    capability: value.capability === "basic" || value.capability === "standard" || value.capability === "strong" || value.capability === "vision" ? value.capability : undefined,
    priority: typeof value.priority === "number" && Number.isFinite(value.priority) ? value.priority : undefined,
  };
}

export function normalizeRouterConfig(value: unknown): RouterConfig {
  const base = DEFAULT_ROUTER_CONFIG;
  if (!isRecord(value)) return base;
  const models: Record<string, RouterModelMetadata> = { ...(base.models ?? {}) };
  const rawModels = isRecord(value.models) ? value.models : {};
  for (const [key, metadata] of Object.entries(rawModels)) {
    const normalized = normalizeMetadata(metadata);
    if (normalized) models[key] = normalized;
  }
  const profiles: Record<string, RouterProfile> = { ...base.profiles };
  const rawProfiles = isRecord(value.profiles) ? value.profiles : {};
  for (const [id, profile] of Object.entries(rawProfiles)) {
    const fallback = profiles[id] ?? { label: id };
    profiles[id] = normalizeProfile(profile, fallback);
  }
  const defaultProfile = typeof value.defaultProfile === "string" && profiles[value.defaultProfile]
    ? value.defaultProfile
    : base.defaultProfile;
  return {
    version: 1,
    enabled: typeof value.enabled === "boolean" ? value.enabled : base.enabled,
    defaultProfile,
    models,
    profiles,
  };
}

function modelKey(model: RouterModelRef): string {
  return `${model.provider}:${model.modelId}`;
}

function metadataForModelKey(config: RouterConfig, model: RouterModel): RouterModelMetadata {
  return config.models?.[modelKey(model)]
    ?? config.models?.[model.modelId]
    // Keep name-based metadata as a user convenience only; provider/modelId is the stable identity.
    ?? config.models?.[model.name]
    ?? {};
}

function stableTextForModel(model: RouterModel): string {
  return `${model.provider} ${model.modelId} ${model.baseUrl ?? ""}`.toLowerCase();
}

function textForModel(model: RouterModel): string {
  return `${model.provider} ${model.modelId} ${model.name} ${model.baseUrl ?? ""}`.toLowerCase();
}

function isLocalBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return true;
    if (/^(127\.|10\.|192\.168\.)/.test(host)) return true;
    const private172 = host.match(/^172\.(\d+)\./);
    return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
  } catch {
    return /^(http:\/\/)?(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(baseUrl.toLowerCase());
  }
}

function isCloudBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl || isLocalBaseUrl(baseUrl)) return false;
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:";
  } catch {
    return baseUrl.toLowerCase().startsWith("https://");
  }
}

function supportsImages(model: RouterModel): boolean {
  const text = textForModel(model);
  return model.input?.includes("image")
    || /\b(vision|gpt-4o|gemini|claude|opus|sonnet|multimodal)\b/.test(text);
}

function metadataForModel(config: RouterConfig, model: RouterModel): Required<RouterModelMetadata> {
  const configured = metadataForModelKey(config, model);
  const text = stableTextForModel(model);
  const allText = textForModel(model);
  const isQwen = text.includes("qwen");
  const isKimi = text.includes("kimi");
  const isLocal = isLocalBaseUrl(model.baseUrl) || /\b(local|ollama|vllm|llama\.cpp)\b/.test(text);
  const isCloud = isCloudBaseUrl(model.baseUrl) || /\b(cloud|openai|anthropic|moonshot|googleapis|azure)\b/.test(text);
  const isCloudStrong = /\b(kimi|opus|sonnet|gpt-5|gpt-4|o3|o1|claude|gemini-pro|deepseek|qwen-max)\b/.test(allText);
  return {
    costClass: configured.costClass ?? (isLocal || isQwen ? "free" : isCloud || isKimi || isCloudStrong ? "paid" : "unknown"),
    deployment: configured.deployment ?? (isLocal || isQwen ? "local" : isCloud || isKimi || isCloudStrong ? "cloud" : "unknown"),
    capability: configured.capability ?? (supportsImages(model) ? "vision" : isKimi || isCloudStrong ? "strong" : isCloud ? "standard" : isQwen ? "standard" : "basic"),
    priority: configured.priority ?? 0,
  };
}

function sameModel(a: RouterModelRef | null | undefined, b: RouterModelRef): boolean {
  return a?.provider === b.provider && a.modelId === b.modelId;
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function classifyTier(message: string, hasImages: boolean, contextTokens?: number | null): { tier: RouterTier; signals: string[]; confidence: number } {
  const text = message.toLowerCase();
  const signals: string[] = [];
  if (hasImages) return { tier: "vision", signals: ["image input"], confidence: 0.95 };

  const chars = message.length;
  const lines = message.split(/\r?\n/).length;
  if (chars > 2500 || lines > 40) signals.push("long prompt");
  if ((contextTokens ?? 0) > 120_000) signals.push("large context");

  const reasoningHits = countMatches(text, [
    /\b(prove|derive|formal|algorithm|complexity|invariant|optimi[sz]e|architecture|migration|distributed)\b/,
    /\b(deep reasoning|think deeply|step by step|trade-?offs?|design doc)\b/,
    /复杂|推理|架构|迁移|权衡|证明|算法/,
  ]);
  const codeHits = countMatches(text, [
    /\b(refactor|debug|bug|test|types?|typescript|react|next\.?js|api|database|schema|concurrent|layer)\b/,
    /\b(implement|fix|review|lint|typecheck|regression|multi-?file)\b/,
    /```|@\w|\/[A-Za-z0-9_.-]+\/|组件|代码|重构|调试|测试|实现/,
  ]);
  const simpleHits = countMatches(text, [
    /\b(summarize|translate|explain|what is|how do i|quick|simple)\b/,
    /总结|翻译|解释|简单|快速/,
  ]);

  if (reasoningHits >= 2) signals.push("reasoning markers");
  if (codeHits >= 2) signals.push("coding task");
  if (simpleHits > 0 && codeHits === 0 && reasoningHits === 0 && chars < 900) signals.push("simple instruction");

  if (reasoningHits >= 2 || /reasoning|推理|深度/.test(text)) {
    return { tier: "reasoning", signals, confidence: 0.86 };
  }
  if (codeHits >= 3 || chars > 2500 || lines > 40 || (contextTokens ?? 0) > 120_000) {
    return { tier: "complex", signals, confidence: 0.78 };
  }
  if (codeHits > 0 || chars > 900) {
    return { tier: "standard", signals, confidence: 0.68 };
  }
  return { tier: "simple", signals, confidence: simpleHits > 0 ? 0.72 : 0.6 };
}

function findAvailable(models: RouterModel[], ref: RouterModelRef | undefined, requireVision: boolean): RouterModel | undefined {
  if (!ref) return undefined;
  const isUsable = (model: RouterModel) => !requireVision || supportsImages(model);
  const exact = models.find((model) => model.provider === ref.provider && model.modelId === ref.modelId && isUsable(model));
  if (exact) return exact;
  const renamedMatches = models.filter((model) => model.modelId === ref.modelId && isUsable(model));
  return renamedMatches.length === 1 ? renamedMatches[0] : undefined;
}

function scoreModel(model: RouterModel, metadata: Required<RouterModelMetadata>, profile: RouterProfile, preferences: string[], tier: RouterTier, requireVision: boolean): number {
  if (requireVision && !supportsImages(model)) return -1;
  const text = textForModel(model);
  let score = metadata.priority;
  preferences.forEach((needle, index) => {
    if (text.includes(needle.toLowerCase())) score += Math.max(1, 20 - index * 2);
  });
  if (metadata.costClass === "free") score += profile.policy === "quality-first" && tier !== "simple" ? -8 : 18;
  if (metadata.deployment === "local") score += profile.policy === "quality-first" && tier !== "simple" ? -6 : 14;
  if (metadata.costClass === "paid") score += profile.policy === "quality-first" ? 16 : profile.policy === "balanced" && (tier === "reasoning" || tier === "vision") ? 12 : -10;
  if (metadata.capability === "strong" || metadata.capability === "vision") {
    score += tier === "complex" || tier === "reasoning" || tier === "vision" ? 14 : -4;
  }
  if (tier === "simple" && /\b(mini|flash|haiku|small|lite)\b/.test(text)) score += 8;
  if ((tier === "complex" || tier === "reasoning") && /\b(opus|sonnet|gpt-5|o3|o1|reasoning|pro)\b/.test(text)) score += 8;
  if (tier === "vision" && supportsImages(model)) score += 10;
  return score;
}

function chooseModel(config: RouterConfig, models: RouterModel[], profile: RouterProfile, tier: RouterTier): { model: RouterModel; metadata: Required<RouterModelMetadata>; fallback: boolean } | null {
  const requireVision = tier === "vision";
  const configured = findAvailable(models, profile.tiers?.[tier], requireVision);
  if (configured) return { model: configured, metadata: metadataForModel(config, configured), fallback: false };

  const preferences = profile.preferences?.[tier] ?? [];
  const candidates = models
    .map((model) => {
      const metadata = metadataForModel(config, model);
      return { model, metadata, score: scoreModel(model, metadata, profile, preferences, tier, requireVision) };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.model.name.localeCompare(b.model.name));
  if (!candidates.length) return null;
  return { model: candidates[0].model, metadata: candidates[0].metadata, fallback: candidates[0].score === 0 };
}

function chooseUpgradeModel(config: RouterConfig, models: RouterModel[], selected: RouterModel, profile: RouterProfile, tier: RouterTier): RouterDecision["upgradeModel"] {
  if (!profile.upgradeTiers?.includes(tier)) return undefined;
  const selectedMetadata = metadataForModel(config, selected);
  if (selectedMetadata.costClass === "paid" && selectedMetadata.deployment === "cloud") return undefined;
  const candidates = models
    .filter((model) => !sameModel(model, selected))
    .map((model) => ({ model, metadata: metadataForModel(config, model), text: textForModel(model) }))
    .filter(({ metadata }) => metadata.costClass === "paid" || metadata.deployment === "cloud" || metadata.capability === "strong" || metadata.capability === "vision")
    .sort((a, b) => {
      const score = (entry: typeof a) =>
        (entry.text.includes("kimi") ? 100 : 0)
        + (entry.metadata.capability === "strong" || entry.metadata.capability === "vision" ? 30 : 0)
        + (entry.metadata.priority ?? 0);
      return score(b) - score(a) || a.model.name.localeCompare(b.model.name);
    });
  const upgrade = candidates[0];
  if (!upgrade) return undefined;
  return {
    provider: upgrade.model.provider,
    modelId: upgrade.model.modelId,
    costClass: upgrade.metadata.costClass,
    deployment: upgrade.metadata.deployment,
    capability: upgrade.metadata.capability,
    reason: "Upgrade if local/free attempt shows objective failure or user asks for higher quality.",
  };
}

export function routeModel(configInput: unknown, request: RouterRequest): RouterDecision | null {
  const config = normalizeRouterConfig(configInput);
  if (!config.enabled) return null;
  const profileId = request.profile && config.profiles[request.profile] ? request.profile : config.defaultProfile;
  const profile = config.profiles[profileId] ?? config.profiles[DEFAULT_ROUTER_CONFIG.defaultProfile];
  if (!profile || request.availableModels.length === 0) return null;

  const classified = classifyTier(request.message, Boolean(request.hasImages), request.contextTokens);
  const selection = chooseModel(config, request.availableModels, profile, classified.tier);
  if (!selection) return null;

  const display = selection.model.name || selection.model.modelId;
  const upgradeModel = chooseUpgradeModel(config, request.availableModels, selection.model, profile, classified.tier);
  const costNote = `${selection.metadata.deployment}/${selection.metadata.costClass}`;
  const upgradeNote = upgradeModel ? `; can upgrade to ${upgradeModel.modelId} on failure` : "";
  const reason = `${profile.label}: ${classified.tier} route -> ${display} (${costNote})${upgradeNote}${classified.signals.length ? ` (${classified.signals.join(", ")})` : ""}`;
  return {
    provider: selection.model.provider,
    modelId: selection.model.modelId,
    tier: classified.tier,
    profile: profileId,
    reason,
    confidence: classified.confidence,
    matchedSignals: classified.signals,
    changed: !sameModel(request.currentModel, selection.model),
    fallback: selection.fallback,
    costClass: selection.metadata.costClass,
    deployment: selection.metadata.deployment,
    capability: selection.metadata.capability,
    upgradeModel,
  };
}
