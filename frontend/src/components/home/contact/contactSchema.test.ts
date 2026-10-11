import { describe, expect, test } from "vitest";
import { contactSchema } from "./contactSchema";

const validInput = {
  name: "山田太郎",
  email: "taro@example.com",
  message: "お問い合わせ内容です。よろしくお願いします。",
};

const errorMessages = (input: unknown): string[] => {
  const result = contactSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
};

describe("contactSchema", () => {
  test("正常な入力は成功する", () => {
    expect(contactSchema.safeParse(validInput).success).toBe(true);
  });

  test("空白のみの名前は失敗する", () => {
    expect(errorMessages({ ...validInput, name: "   " })).toContain(
      "名前を入力してください",
    );
  });

  test("101文字以上の名前は失敗する", () => {
    expect(errorMessages({ ...validInput, name: "a".repeat(101) })).toContain(
      "100文字以内で入力してください",
    );
  });

  test("不正なメールアドレスは失敗する", () => {
    expect(errorMessages({ ...validInput, email: "not-an-email" })).toContain(
      "無効なメールアドレスです",
    );
  });

  test("10文字未満のメッセージは失敗する", () => {
    expect(errorMessages({ ...validInput, message: "短い" })).toContain(
      "10文字以上入力してください",
    );
  });

  test("1001文字以上のメッセージは失敗する", () => {
    expect(
      errorMessages({ ...validInput, message: "a".repeat(1001) }),
    ).toContain("1000文字以内で入力してください");
  });
});
