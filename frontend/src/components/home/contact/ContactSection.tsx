import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LuSend } from "react-icons/lu";
import { useContact } from "./useContact";
import "./contact.css";

const queryClient = new QueryClient();

function ContactContent() {
  const { values, errors, isSent, isPending, setValue, handleSubmit } =
    useContact();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="contact-gsap flex flex-col gap-1.5">
        <input
          type="text"
          value={values.name}
          onChange={(e) => setValue("name", e.target.value)}
          placeholder="お名前"
          autoComplete="name"
          className={`form-input-select contact-field${errors.name ? " contact-field-error" : ""}`}
        />
        {errors.name && <p className="contact-error-text">{errors.name}</p>}
      </div>

      <div className="contact-gsap flex flex-col gap-1.5">
        <input
          type="email"
          value={values.email}
          onChange={(e) => setValue("email", e.target.value)}
          placeholder="メールアドレス"
          autoComplete="email"
          className={`form-input-select contact-field${errors.email ? " contact-field-error" : ""}`}
        />
        {errors.email && <p className="contact-error-text">{errors.email}</p>}
      </div>

      <div className="contact-gsap flex flex-col gap-1.5">
        <textarea
          value={values.message}
          onChange={(e) => setValue("message", e.target.value)}
          placeholder="お問い合わせ内容"
          rows={10}
          className={`form-textarea contact-field custom-scrollbar${errors.message ? " contact-field-error" : ""}`}
        />
        {errors.message && (
          <p className="contact-error-text">{errors.message}</p>
        )}
      </div>

      <div className="contact-gsap flex items-center justify-end gap-4">
        {isSent && <p className="text-sm text-violet-500">送信しました</p>}
        <button
          type="submit"
          disabled={isPending}
          className="outline-button gap-2"
        >
          <LuSend size={14} />
          {isPending ? "送信中..." : "送信"}
        </button>
      </div>
    </form>
  );
}

export default function ContactSection() {
  return (
    <QueryClientProvider client={queryClient}>
      <ContactContent />
    </QueryClientProvider>
  );
}
