import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendContact } from "./contactApi";
import type { ContactRequest, ContactResponse } from "./contactApi";
import { contactSchema } from "./contactSchema";
import type { ContactFieldErrors } from "./contactSchema";
import { showErrorDialog } from "../../../layouts/error-dialog/errorDialog";

const EMPTY_FORM: ContactRequest = { name: "", email: "", message: "" };

export function useContact() {
  const [values, setValues] = useState<ContactRequest>(EMPTY_FORM);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [isSent, setIsSent] = useState(false);

  const mutation = useMutation<ContactResponse, Error, ContactRequest>({
    mutationFn: sendContact,
  });

  const setValue = (field: keyof ContactRequest, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setIsSent(false);
  };

  const handleSubmit = () => {
    if (mutation.isPending) return;

    const result = contactSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: ContactFieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ContactRequest | undefined;
        if (!field || fieldErrors[field]) continue;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    mutation.mutate(result.data, {
      onSuccess: () => {
        setValues(EMPTY_FORM);
        setIsSent(true);
      },
      onError: (error) => {
        showErrorDialog(`お問い合わせの送信に失敗しました: ${error.message}`);
      },
    });
  };

  return {
    values,
    errors,
    isSent,
    isPending: mutation.isPending,
    setValue,
    handleSubmit,
  };
}
