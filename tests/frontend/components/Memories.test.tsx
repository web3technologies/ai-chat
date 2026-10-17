import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/services/memory", () => ({
  memoryService: {
    list: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import Memories from "@/ui/components/Memories";
import { memoryService } from "@/ui/services/memory";

const rows = [
  { id: "m1", content: "likes pizza", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "m2", content: "lives in Kansas City", createdAt: "2026-01-02", updatedAt: "2026-01-02" },
];

describe("Memories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(memoryService.list).mockResolvedValue(rows);
  });

  it("shows one row per fact and Save only after an edit", async () => {
    render(<Memories onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue("likes pizza")).toBeInTheDocument();
    expect(screen.getByDisplayValue("lives in Kansas City")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("likes pizza"), { target: { value: "likes tacos" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("deletes the row that was clicked", async () => {
    vi.mocked(memoryService.remove).mockResolvedValue(undefined);
    render(<Memories onClose={vi.fn()} />);
    await screen.findByDisplayValue("likes pizza");

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(memoryService.remove).toHaveBeenCalledWith("m1");
  });
});
