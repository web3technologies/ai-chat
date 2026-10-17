import { userService } from "@/backend/services/auth/user";

export async function POST(request: Request) {
  const result = await userService.signup(request);
  if (!result.ok) {
    if (result.reason === "taken") {
      return Response.json({ error: "Username is already taken" }, { status: 409 });
    }
    return Response.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  return Response.json({ token: result.token, user: result.user }, { status: 201 });
}
