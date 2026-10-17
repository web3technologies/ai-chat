import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/services/auth", () => ({
  authService: { listUsers: vi.fn() },
}));

import CreateChat from "@/ui/components/CreateChat";
import { authService } from "@/ui/services/auth";

describe("CreateChat", () => {
  beforeEach(() => {
    vi.mocked(authService.listUsers).mockResolvedValue([
      { id: "jordan", username: "jordan", name: "Jordan", kind: "HUMAN" },
      { id: "alex", username: "alex", name: "Alex", kind: "HUMAN" },
    ]);
  });

  it("starts as a create button", () => {
    render(<CreateChat currentUserId="me" onCreate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Group name")).not.toBeInTheDocument();
  });

  it("keeps submit disabled until people and a group name are chosen", async () => {
    render(<CreateChat currentUserId="me" onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    const submit = await screen.findByRole("button", { name: "Create" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Jordan/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Alex/ }));
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Group name"), { target: { value: "Dinner" } });
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });
});
