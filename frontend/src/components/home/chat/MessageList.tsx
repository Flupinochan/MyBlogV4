import type { Message } from "./useChat";

type MessageListProps = {
  messages: Message[];
  isPending: boolean;
  error: Error | undefined;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export default function MessageList({
  messages,
  isPending,
  error,
  messagesEndRef,
}: MessageListProps) {
  return (
    <div className="custom-scrollbar flex w-full flex-col gap-3 overflow-y-auto p-4">
      {messages.length === 0 && (
        <p className="m-auto text-sm text-slate-400">
          経歴やスキルについてお気軽にご質問ください!
        </p>
      )}
      {messages.map((msg) => (
        <p
          key={msg.id}
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
  );
}
