import { FiSidebar } from "react-icons/fi";
import { IoIosAddCircle } from "react-icons/io";
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
import {
  sendTextMessage,
  sendVoiceMessage,
  detectLanguage,
  generateChatTitle,
} from "./chatApi";
import type { ChatRequest, TextChatResponse, VoiceChatResponse } from "./chatApi";
import { showErrorDialog } from "../../../layouts/error-dialog/errorDialog";
import "./chat.css";

type MessageParam = ChatRequest["messages"][number];
type Message = Omit<MessageParam, "content"> & { content: string };
type History = { id: string; name: string; messages: Message[] };

type ChatDetectInput = {
  messages: Message[];
  withVoice: boolean;
  isFirst: boolean;
};

type ChatDetectResult = {
  chatResult: TextChatResponse | VoiceChatResponse;
  lang: string | undefined;
};

const queryClient = new QueryClient();

function ChatContent() {
  const { current: initialId } = useRef(new Date().toISOString());
  const [histories, setHistories] = useState<History[]>([
    { id: initialId, name: "新しいチャット", messages: [] },
  ]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string>(initialId);
  const currentHistory = histories.find((h) => h.id === currentHistoryId)!;
  const messages = currentHistory.messages;
  const [inputMessage, setInputMessage] = useState("");
  const [withVoice, setWithVoice] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    setHistories((prev) =>
      prev.map((h) =>
        h.id === currentHistoryId ? { ...h, messages: updater(h.messages) } : h,
      ),
    );
  };

  const chatDetectMutation = useMutation<
    ChatDetectResult,
    Error,
    ChatDetectInput
  >({
    mutationFn: async ({ messages, withVoice, isFirst }) => {
      const [chatResult, lang] = await Promise.all([
        withVoice
          ? sendVoiceMessage({ messages })
          : sendTextMessage({ messages }),
        isFirst && "LanguageDetector" in self
          ? detectLanguage(messages[messages.length - 1]?.content ?? "").catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      return { chatResult, lang };
    },
  });

  const handleSubmit = () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || chatDetectMutation.isPending) return;

    const isFirst = messages.length === 0;
    setInputMessage("");
    flushSync(() => {
      setHistories((prev) =>
        prev.map((h) => {
          if (h.id !== currentHistoryId) return h;
          return {
            ...h,
            name: isFirst ? trimmedMessage.slice(0, 20) : h.name,
            messages: [
              ...h.messages,
              { role: "user", content: trimmedMessage },
            ],
          };
        }),
      );
    });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    chatDetectMutation.mutate(
      { messages: [...messages, { role: "user", content: trimmedMessage }], withVoice, isFirst },
      {
        onSuccess: async ({ chatResult, lang }) => {
          flushSync(() => {
            updateMessages((prev) => [
              ...prev,
              { role: "assistant", content: chatResult.message },
            ]);
          });
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          if ("voice_path" in chatResult) {
            try {
              await new Audio(chatResult.voice_path).play();
            } catch (error) {
              showErrorDialog(`音声の再生に失敗しました: ${error}`);
            }
          }
          if (!isFirst || !("Summarizer" in self)) return;
          try {
            const text = `User: ${trimmedMessage}\nAssistant: ${chatResult.message}`;
            const title = await generateChatTitle(text, lang);
            if (!title) return;
            setHistories((prev) =>
              prev.map((h) =>
                h.id === currentHistoryId ? { ...h, name: title } : h,
              ),
            );
          } catch (e) {
            console.error("チャットタイトルの生成に失敗しました:", e);
          }
        },
      },
    );
  };

  const handleNewHistory = () => {
    const newId = new Date().toISOString();
    setHistories((prev) => [
      ...prev,
      { id: newId, name: "新しいチャット", messages: [] },
    ]);
    setCurrentHistoryId(newId);
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
        className="flex flex-row h-[360px] timeline-gsap
                      rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50"
      >
        <nav
          className={`flex flex-col p-2 gap-1 border-r border-slate-300 dark:border-slate-600 ${isNavOpen ? "w-50" : "w-14"} transition-[width] duration-300`}
        >
          <button
            className={`nav-item flex h-10 justify-end`}
            onClick={() => setIsNavOpen((prev) => !prev)}
          >
            <FiSidebar className="h-full w-auto shrink-0" />
          </button>
          <button
            className="nav-item flex h-10 flex-row gap-2"
            onClick={handleNewHistory}
          >
            <IoIosAddCircle className="h-full w-auto shrink-0" />
            <p
              className={`whitespace-nowrap transition-opacity duration-200 ${isNavOpen ? "opacity-100 delay-150" : "opacity-0"}`}
            >
              新規作成
            </p>
          </button>
          <ul
            className="history-list custom-scrollbar space-y-1 overflow-y-auto flex-1 min-h-0"
            style={
              {
                "--active-anchor": `--hist-${currentHistoryId.replace(/[:.]/g, "-")}`,
              } as React.CSSProperties
            }
          >
            {[...histories]
              .sort((a, b) => b.id.localeCompare(a.id))
              .map((h) => (
                <li
                  key={h.id}
                  style={
                    {
                      anchorName: `--hist-${h.id.replace(/[:.]/g, "-")}`,
                    } as React.CSSProperties
                  }
                  className="nav-item relative z-10"
                  onClick={() => setCurrentHistoryId(h.id)}
                >
                  {h.name}
                </li>
              ))}
          </ul>
        </nav>
        <div className="custom-scrollbar flex w-full flex-col gap-3 overflow-y-auto p-4">
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
          {chatDetectMutation.error && (
            <p className="max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap self-start bg-rose-300 text-white">
              {chatDetectMutation.error.message}
            </p>
          )}
          {chatDetectMutation.isPending && (
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
            disabled={chatDetectMutation.isPending || !inputMessage.trim()}
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
