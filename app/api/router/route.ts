import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { NextResponse } from "next/server";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { DEFAULT_ROUTER_CONFIG, normalizeRouterConfig } from "@/lib/llm-router";

export const dynamic = "force-dynamic";

function getRouterPath(): string {
  return join(getAgentDir(), "router.json");
}

function readRouterConfig(): unknown {
  const path = getRouterPath();
  if (!existsSync(path)) return DEFAULT_ROUTER_CONFIG;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return DEFAULT_ROUTER_CONFIG;
  }
}

function writeRouterConfig(data: unknown): void {
  const path = getRouterPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(normalizeRouterConfig(data), null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(normalizeRouterConfig(readRouterConfig()));
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as unknown;
    const config = normalizeRouterConfig(body);
    writeRouterConfig(config);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
