import { z } from "zod";
import type { ContactRequest } from "./contactApi";

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "名前を入力してください" })
    .max(100, { error: "100文字以内で入力してください" }),
  email: z.email({ error: "無効なメールアドレスです" }),
  message: z
    .string()
    .trim()
    .min(10, { error: "10文字以上入力してください" })
    .max(1000, { error: "1000文字以内で入力してください" }),
});

export type ContactFieldErrors = Partial<Record<keyof ContactRequest, string>>;
