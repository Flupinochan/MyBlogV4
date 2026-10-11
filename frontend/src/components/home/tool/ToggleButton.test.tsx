import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ToggleButton } from "./ToggleButton";

describe("ToggleButton", () => {
  test("labelをボタンとして表示する", () => {
    render(<ToggleButton label="aws" isActive={false} onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "aws" })).toBeInTheDocument();
  });

  test("クリックするとonClickが1回呼ばれる", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ToggleButton label="aws" isActive={false} onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "aws" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("isActiveの場合のみ強調クラスを付与する", () => {
    const { rerender } = render(
      <ToggleButton label="aws" isActive={true} onClick={vi.fn()} />,
    );
    expect(screen.getByRole("button")).toHaveClass("bg-violet-500/35");

    rerender(<ToggleButton label="aws" isActive={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).not.toHaveClass("bg-violet-500/35");
  });
});
