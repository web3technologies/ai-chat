import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/services/memory", () => ({
  memoryService: {
    list: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import useMemories from "@/ui/hooks/useMemories";
import { memoryService } from "@/ui/services/memory";

const memory = {
  id: "m1",
  content: "likes pizza",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("useMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads memories and clears the loading flag", async () => {
    vi.mocked(memoryService.list).mockResolvedValue([memory]);
    const { result } = renderHook(() => useMemories());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.memories).toEqual([memory]);
  });

  it("replaces an updated row and drops a deleted one", async () => {
    vi.mocked(memoryService.list).mockResolvedValue([memory]);
    const next = { ...memory, content: "likes tacos" };
    vi.mocked(memoryService.update).mockResolvedValue(next);
    vi.mocked(memoryService.remove).mockResolvedValue(undefined);
    const { result } = renderHook(() => useMemories());
    await waitFor(() => expect(result.current.memories).toHaveLength(1));

    await act(async () => {
      await expect(result.current.update("m1", "likes tacos")).resolves.toBe(true);
    });
    expect(result.current.memories).toEqual([next]);

    await act(async () => {
      await expect(result.current.remove("m1")).resolves.toBe(true);
    });
    expect(result.current.memories).toEqual([]);
  });

  it("returns false and records an error when an update fails", async () => {
    vi.mocked(memoryService.list).mockResolvedValue([memory]);
    vi.mocked(memoryService.update).mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useMemories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.update("m1", "likes tacos")).resolves.toBe(false);
    });
    expect(result.current.error).toBe("nope");
  });
});
