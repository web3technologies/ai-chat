import { authToken } from "@/backend/services/auth/token";
import { memoryService } from "@/backend/services/memory/memory";

export async function GET(request: Request) {
  const userId = await authToken.userIdFromRequest(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await memoryService.list(userId);
  return Response.json({ memories });
}
