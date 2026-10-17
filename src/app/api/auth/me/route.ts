import { userService } from "@/backend/services/auth/user";

export async function GET(request: Request) {
  const user = await userService.current(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ user });
}
