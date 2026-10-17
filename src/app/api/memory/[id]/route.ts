import { authToken } from "@/backend/services/auth/token";
import { memoryService } from "@/backend/services/memory/memory";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authToken.userIdFromRequest(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const content = await messageContent(request);
  if (!content) {
    return Response.json({ error: "Memory content is required" }, { status: 400 });
  }

  const result = await memoryService.update(userId, id, content);
  if (!result.ok) {
    if (result.reason === "invalid") {
      return Response.json({ error: "Memory content is required" }, { status: 400 });
    }
    return Response.json({ error: "Memory not found" }, { status: 404 });
  }

  return Response.json({ memory: result.memory });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authToken.userIdFromRequest(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await memoryService.remove(userId, id);
  if (!result.ok) {
    return Response.json({ error: "Memory not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}

async function messageContent(request: Request) {
  try {
    const body = (await request.json()) as { content?: unknown };
    return typeof body.content === "string" ? body.content : null;
  } catch {
    return null;
  }
}
