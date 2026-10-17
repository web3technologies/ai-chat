import { userService } from "@/backend/services/auth/user";

export async function GET(request: Request) {
  const users = await userService.list(request);
  if (!users) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ users });
}
