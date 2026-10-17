import { userService } from "@/backend/services/auth/user";

export async function POST(request: Request) {
  const result = await userService.signin(request);
  if (!result.ok) {
    if (result.reason === "unauthorized") {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }
    return Response.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  return Response.json({ token: result.token, user: result.user });
}
