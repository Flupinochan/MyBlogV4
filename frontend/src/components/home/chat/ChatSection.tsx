import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { LuSend } from "react-icons/lu";
import { LuType } from "react-icons/lu";
import { LuVolume2 } from "react-icons/lu";
import { sendTextMessage, sendVoiceMessage } from "./chatApi";
import type { TextChatResponse, VoiceChatResponse } from "./chatApi";
import { showErrorDialog } from "../../../layouts/error-dialog/errorDialog";
import "./chat.css";

type Message = { role: "user" | "assistant"; content: string };

const queryClient = new QueryClient();

function ChatContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [withVoice, setWithVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { mutate, isPending, error } = useMutation({
    mutationFn: ({
      message,
      withVoice,
    }: {
      message: string;
      withVoice: boolean;
    }): Promise<TextChatResponse | VoiceChatResponse> =>
      withVoice ? sendVoiceMessage({ message }) : sendTextMessage({ message }),
  });

  const handleSubmit = () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isPending) return;

    setInputMessage("");
    flushSync(() => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmedMessage },
      ]);
    });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    mutate(
      { message: trimmedMessage, withVoice },
      {
        onSuccess: (result) => {
          flushSync(() => {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: result.message },
            ]);
          });
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          if ("voicePath" in result) {
            void new Audio(result.voicePath)
              .play()
              .catch((error) =>
                showErrorDialog(`音声の再生に失敗しました: ${error}`),
              );
          }
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col">
      <div
        className="timeline-gsap custom-scrollbar flex h-[360px] flex-col gap-3 overflow-y-auto rounded-2xl border
                    border-slate-200 dark:border-slate-700 bg-white/50 p-4 dark:bg-slate-900/50"
      >
        {messages.length === 0 && (
          <p className="m-auto text-sm text-slate-400">
            メッセージを入力して送信してください
          </p>
        )}
        {messages.map((msg, i) => (
          <p
            key={i}
            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "self-end bg-violet-500 text-white"
                : "self-start bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-50"
            }`}
          >
            {msg.content}
          </p>
        ))}
        {error && (
          <p className="max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap self-start bg-rose-300 text-white">
            {error.message}
          </p>
        )}
        {isPending && (
          <div
            className="flex justify-start items-center space-x-1"
            aria-label="読み込み中"
          >
            <div className="h-1 w-1 rounded-full bg-slate-500 animate-pulse" />
            <div className="h-1 w-1 rounded-full bg-slate-500 animate-pulse [animation-delay:150ms]" />
            <div className="h-1 w-1 rounded-full bg-slate-500 animate-pulse [animation-delay:300ms]" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex flex-col gap-2 mt-2 text-sm"
      >
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力…"
          rows={2}
          className="timeline-gsap form-textarea custom-scrollbar"
        />
        <div className="timeline-gsap flex items-center justify-between">
          <div className="flex rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setWithVoice(false)}
              className={`gap-1.5 rounded-l-xl px-4 py-1.5 ${
                !withVoice ? "white-button" : "transparent-button"
              }`}
            >
              <LuType size={14} />
              テキストのみ
            </button>
            <button
              type="button"
              onClick={() => setWithVoice(true)}
              className={`gap-1.5 rounded-r-xl px-4 py-1.5 ${
                withVoice ? "white-button" : "transparent-button"
              }`}
            >
              <LuVolume2 size={14} />
              テキスト + 読み上げ
            </button>
          </div>
          <button
            type="submit"
            disabled={isPending || !inputMessage.trim()}
            className="violet-button gap-2 rounded-xl px-5 py-2"
          >
            <LuSend size={14} />
            送信
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ChatSection() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatContent />
    </QueryClientProvider>
  );
}
