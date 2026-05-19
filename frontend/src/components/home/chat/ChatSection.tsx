import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

async function sendTextMessage(message: string): Promise<string> {
  const response = await fetch("/api/fastapi/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { message: string };
  return data.message;
}

async function sendVoiceMessage(
  message: string,
): Promise<{ message: string; key: string }> {
  const response = await fetch("/api/fastapi/chat/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    message: string;
    bucket: string;
    key: string;
  };
  return { message: data.message, key: data.key };
}

export default function ChatSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [voiceMode, setVoiceMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setError(undefined);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsLoading(true);

    try {
      if (voiceMode) {
        const { message, key } = await sendVoiceMessage(trimmed);
        setMessages((prev) => [...prev, { role: "assistant", content: message }]);
        void new Audio(key).play().catch(() =>
          setError("音声の再生に失敗しました"),
        );
      } else {
        const reply = await sendTextMessage(trimmed);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setVoiceMode((v) => !v)}
          className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
            voiceMode
              ? "bg-violet-600 text-white"
              : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {voiceMode ? "音声モード" : "テキストモード"}
        </button>
      </div>

      <div className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-slate-400">
            メッセージを入力して送信してください
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <span className="animate-pulse">...</span>
            </span>
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-rose-500">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力… (Enter で送信、Shift+Enter で改行)"
          rows={2}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-medium text-white transition-opacity hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}
