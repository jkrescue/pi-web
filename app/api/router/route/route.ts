import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { stat } from "fs/promises";
import { NextResponse } from "next/server";
import { createAgentSessionServices, getAgentDir } from "@earendil-works/pi-coding-agent";
import { DEFAULT_ROUTER_CONFIG, normalizeRouterConfig, routeModel, type RouterModel, type RouterModelRef } from "@/lib/llm-router";

export const dynamic = "force-dynamic";

interface RouteBody {
  cwd?: string;
  message?: string;
  hasImages?: boolean;
  currentModel?: RouterModelRef | null;
  profile?: string;
  contextTokens?: number | null;
}

interface ProviderInfo {
  api?: string;
  baseUrl?: string;
}

function readRouterConfig(): unknown {
  const path = join(getAgentDir(), "router.json");
  if (!existsSync(path)) return DEFAULT_ROUTER_CONFIG;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return DEFAULT_ROUTER_CONFIG;
  }
}

function readProviderInfo(agentDir: string): Map<string, ProviderInfo> {
  const path = join(agentDir, "models.json");
  if (!existsSync(path)) return new Map();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const providers = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as { providers?: unknown }).providers
      : null;
    if (!providers || typeof providers !== "object" || Array.isArray(providers)) return new Map();
    return new Map(Object.entries(providers).map(([name, value]) => {
      const provider = typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as { api?: unknown; baseUrl?: unknown }
        : {};
      return [name, {
        api: typeof provider.api === "string" ? provider.api : undefined,
        baseUrl: typeof provider.baseUrl === "string" ? provider.baseUrl : undefined,
      }];
    }));
  } catch {
    return new Map();
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as RouteBody;
    const cwd = body.cwd;
    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "cwd required" }, { status: 400 });
    }
    if (!body.message && !body.hasImages) {
      return NextResponse.json({ error: "message or image input required" }, { status: 400 });
    }

    const cwdStat = await stat(cwd).catch(() => null);
    if (!cwdStat?.isDirectory()) {
      return NextResponse.json({ error: `Not a directory: ${cwd}` }, { status: 400 });
    }

    const agentDir = getAgentDir();
    const services = await createAgentSessionServices({ cwd, agentDir });
    const providerInfo = readProviderInfo(agentDir);
    const availableModels = services.modelRegistry.getAvailable().map((model) => ({
      provider: model.provider,
      modelId: model.id,
      name: model.name,
      input: Array.isArray(model.input) ? model.input : undefined,
      api: providerInfo.get(model.provider)?.api,
      baseUrl: providerInfo.get(model.provider)?.baseUrl,
    })) satisfies RouterModel[];

    const config = normalizeRouterConfig(readRouterConfig());
    const decision = routeModel(config, {
      cwd,
      message: body.message ?? "",
      hasImages: body.hasImages,
      currentModel: body.currentModel ?? null,
      profile: body.profile,
      contextTokens: body.contextTokens ?? null,
      availableModels,
    });

    return NextResponse.json({ decision, config });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
