import { chatService } from "@/backend/services/chat/chat";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await chatService.get(request, id);
  if (!result.ok) return chatError(result);
  return Response.json({ chat: result.chat });
}

function chatError(result: { reason: "unauthorized" | "not_found" | "invalid"; error?: string }) {
  if (result.reason === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (result.reason === "not_found") {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }
  return Response.json({ error: result.error ?? "Invalid chat" }, { status: 400 });
}
