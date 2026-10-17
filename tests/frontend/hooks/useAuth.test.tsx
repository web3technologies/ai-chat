import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/services/auth", () => ({
  authService: {
    current: vi.fn(),
    signOut: vi.fn(),
  },
}));

import { useAuthState } from "@/ui/hooks/useAuth";
import { authService } from "@/ui/services/auth";

const user = { id: "user-1", username: "sam", name: "Sam", kind: "HUMAN" as const };

describe("useAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finishes loading with no user when the session is empty", async () => {
    vi.mocked(authService.current).mockResolvedValue(null);
    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("clears the user on sign out", async () => {
    vi.mocked(authService.current).mockResolvedValue(user);
    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.user).toEqual(user));
    act(() => result.current.signOut());
    expect(authService.signOut).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });
});
