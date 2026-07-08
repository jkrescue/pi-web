import { NextResponse } from "next/server";
import { resolveSessionPath } from "@/lib/session-reader";
import { startRpcSession, getRpcSession } from "@/lib/rpc-manager";
import { SessionManager } from "@earendil-works/pi-coding-agent";

function isStaleModelRegistryError(error: unknown, commandType: string | undefined): boolean {
  if (commandType !== "set_model") return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("Model not found:");
}

function isBusyAgentState(state: unknown): boolean {
  if (typeof state !== "object" || state === null) return false;
  const liveState = state as { isStreaming?: unknown; isCompacting?: unknown };
  return liveState.isStreaming === true || liveState.isCompacting === true;
}

// POST /api/agent/[id] - Send a command to an existing session
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json() as { type: string; [key: string]: unknown };

    // Fast path: already-running session
    const existing = getRpcSession(id);
    if (existing?.isAlive()) {
      try {
        const result = await existing.send(body);
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        if (!isStaleModelRegistryError(error, body.type)) throw error;
        // A running AgentSession keeps the model registry it was created with.
        // If models.json changed, rebuild the wrapper and retry set_model once.
        existing.destroy();
      }
    }

    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? process.cwd();

    const { session } = await startRpcSession(id, filePath, cwd);
    const result = await session.send(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET /api/agent/[id] - Get current agent state
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = getRpcSession(id);
    if (!session || !session.isAlive()) {
      return NextResponse.json({ running: false });
    }

    const state = await session.send({ type: "get_state" });
    return NextResponse.json({ running: isBusyAgentState(state), state });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
