import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Badge } from "./Badge";
import { COLOR_MAP } from "./badge.types";

describe("Badge", () => {
  test("childrenを表示する", () => {
    render(<Badge color="violet">TypeScript</Badge>);

    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  test("colorに応じたクラスを付与する", () => {
    render(<Badge color="cyan">cyan</Badge>);

    expect(screen.getByText("cyan")).toHaveClass(...COLOR_MAP.cyan.split(" "));
  });

  test("roundedに応じた角丸クラスを付与する", () => {
    render(
      <>
        <Badge color="violet">full</Badge>
        <Badge color="violet" rounded="md">
          md
        </Badge>
      </>,
    );

    expect(screen.getByText("full")).toHaveClass("rounded-full");
    expect(screen.getByText("md")).toHaveClass("rounded-md");
  });

  test("border指定の場合のみ枠線クラスを付与する", () => {
    render(
      <>
        <Badge color="violet">plain</Badge>
        <Badge color="violet" border>
          bordered
        </Badge>
      </>,
    );

    expect(screen.getByText("plain")).not.toHaveClass("border");
    expect(screen.getByText("bordered")).toHaveClass("border");
  });
});
