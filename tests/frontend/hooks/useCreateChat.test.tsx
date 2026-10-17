import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import type { FormEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/services/auth", () => ({
  authService: { listUsers: vi.fn() },
}));

import useCreateChat from "@/ui/hooks/useCreateChat";
import { authService } from "@/ui/services/auth";

const people = [
  { id: "me", username: "sam", name: "Sam", kind: "HUMAN" as const },
  { id: "agent", username: "agent", name: "Agent", kind: "AGENT" as const },
  { id: "jordan", username: "jordan", name: "Jordan", kind: "HUMAN" as const },
  { id: "alex", username: "alex", name: "Alex", kind: "HUMAN" as const },
  { id: "blank", username: null, name: "Blank", kind: "HUMAN" as const },
];

function submitEvent() {
  return { preventDefault() {} } as FormEvent;
}

describe("useCreateChat", () => {
  const onCreate = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.listUsers).mockResolvedValue(people);
  });

  it("drops the current user, the agent, and anyone without a username", async () => {
    const { result } = renderHook(() => useCreateChat("me", onCreate));
    act(() => result.current.setOpen(true));

    await waitFor(() => expect(result.current.people.map((person) => person.username)).toEqual(["jordan", "alex"]));
  });

  it("submits a direct message for one person and a named group for more", async () => {
    const { result } = renderHook(() => useCreateChat("me", onCreate));
    act(() => result.current.setOpen(true));
    await waitFor(() => expect(result.current.people).toHaveLength(2));

    act(() => result.current.toggle("jordan"));
    await act(async () => {
      await result.current.submit(submitEvent());
    });
    expect(onCreate).toHaveBeenCalledWith({ kind: "DM", usernames: ["jordan"], name: undefined });

    act(() => {
      result.current.setOpen(true);
      result.current.toggle("jordan");
      result.current.toggle("alex");
    });
    await act(async () => {
      await result.current.submit(submitEvent());
    });
    expect(onCreate).toHaveBeenCalledTimes(1);

    act(() => result.current.setName("Dinner"));
    await act(async () => {
      await result.current.submit(submitEvent());
    });
    expect(onCreate).toHaveBeenLastCalledWith({ kind: "GROUP", usernames: ["jordan", "alex"], name: "Dinner" });
  });
});
