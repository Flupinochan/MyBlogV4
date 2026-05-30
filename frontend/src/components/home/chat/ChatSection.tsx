import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LuSend } from "react-icons/lu";
import { LuType } from "react-icons/lu";
import { LuVolume2 } from "react-icons/lu";
import { useChat } from "./useChat";
import ChatNav from "./ChatNav";
import MessageList from "./MessageList";
import "./chat.css";

const queryClient = new QueryClient();

function ChatContent() {
  const {
    histories,
    currentHistoryId,
    setCurrentHistoryId,
    messages,
    inputMessage,
    setInputMessage,
    withVoice,
    setWithVoice,
    isNavOpen,
    setIsNavOpen,
    messagesEndRef,
    chatDetectMutation,
    handleSubmit,
    handleNewHistory,
    handleKeyDown,
  } = useChat();

  return (
    <div className="flex flex-col">
      <div
        className="flex flex-row h-[360px] timeline-gsap
                      rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50"
      >
        <ChatNav
          isNavOpen={isNavOpen}
          histories={histories}
          currentHistoryId={currentHistoryId}
          onToggleNav={() => setIsNavOpen((prev) => !prev)}
          onNewHistory={handleNewHistory}
          onSelectHistory={setCurrentHistoryId}
        />
        <MessageList
          messages={messages}
          isPending={chatDetectMutation.isPending}
          error={chatDetectMutation.error ?? undefined}
          messagesEndRef={messagesEndRef}
        />
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
              className={`gap-1.5 rounded-l-xl px-4 py-1.5 ${!withVoice ? "white-button" : "transparent-button"}`}
            >
              <LuType size={14} />
              テキストのみ
            </button>
            <button
              type="button"
              onClick={() => setWithVoice(true)}
              className={`gap-1.5 rounded-r-xl px-4 py-1.5 ${withVoice ? "white-button" : "transparent-button"}`}
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
