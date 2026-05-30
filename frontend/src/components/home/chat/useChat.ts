import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import {
  sendTextMessage,
  sendVoiceMessage,
  detectLanguage,
  generateChatTitle,
  getConversations,
  updateConversationTitle,
} from "./chatApi";
import type { ChatRequest, TextChatResponse, VoiceChatResponse } from "./chatApi";
import { showErrorDialog } from "../../../layouts/error-dialog/errorDialog";

const USER_ID_KEY = "chat_user_id";

function getUserId(): string {
  const stored = localStorage.getItem(USER_ID_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}

export type MessageParam = ChatRequest["messages"][number];
export type Message = Omit<MessageParam, "content"> & { content: string; id: string };
export type History = {
  id: string;
  conversationId: string | undefined;
  name: string;
  updatedAt: string;
  messages: Message[];
};

type ChatDetectInput = {
  messages: Message[];
  withVoice: boolean;
  isFirst: boolean;
  userId: string;
  conversationId: string | undefined;
};

type ChatDetectResult = {
  chatResult: TextChatResponse | VoiceChatResponse;
  lang: string | undefined;
  conversationId: string;
};

export function useChat() {
  const { current: initialId } = useRef(new Date().toISOString());
  const userIdRef = useRef('');
  const [histories, setHistories] = useState<History[]>([
    { id: initialId, conversationId: undefined, name: "新しいチャット", updatedAt: initialId, messages: [] },
  ]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string>(initialId);
  const currentHistory = histories.find((h) => h.id === currentHistoryId);
  const messages = currentHistory?.messages ?? [];
  const [inputMessage, setInputMessage] = useState("");
  const [withVoice, setWithVoice] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      userIdRef.current = getUserId();
      try {
        const conversations = await getConversations(userIdRef.current);
        if (conversations.length === 0) return;
        const loaded: History[] = conversations.map((c) => ({
          id: c.id,
          conversationId: c.id,
          name: c.title,
          updatedAt: c.updated_at,
          messages: c.messages,
        }));
        setHistories(loaded);
        const firstId = loaded[0]?.id;
        if (firstId) setCurrentHistoryId(firstId);
      } catch (e) {
        console.error("会話履歴の取得に失敗しました:", e);
      }
    };
    load();
  }, []);

  const updateCurrentHistory = (updater: (h: History) => History) =>
    setHistories((prev) =>
      prev.map((h) => (h.id === currentHistoryId ? updater(h) : h)),
    );

  const chatDetectMutation = useMutation<ChatDetectResult, Error, ChatDetectInput>({
    mutationFn: async ({ messages, withVoice, isFirst, userId, conversationId }) => {
      const request: ChatRequest = {
        messages,
        user_id: userId,
        conversation_id: conversationId ?? null,
      };
      const [chatResult, lang] = await Promise.all([
        withVoice ? sendVoiceMessage(request) : sendTextMessage(request),
        isFirst && "LanguageDetector" in self
          ? detectLanguage(messages[messages.length - 1]?.content ?? "").catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      return { chatResult, lang, conversationId: chatResult.conversation_id };
    },
  });

  const handleSubmit = () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || chatDetectMutation.isPending || !currentHistory) return;

    const isFirst = messages.length === 0;
    const newUserMessage: Message = {
      role: "user",
      content: trimmedMessage,
      id: crypto.randomUUID(),
    };
    setInputMessage("");
    flushSync(() => {
      updateCurrentHistory((h) => ({
        ...h,
        name: isFirst ? trimmedMessage.slice(0, 20) : h.name,
        messages: [...h.messages, newUserMessage],
      }));
    });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    chatDetectMutation.mutate(
      { messages: [...messages, newUserMessage], withVoice, isFirst, userId: userIdRef.current, conversationId: currentHistory.conversationId },
      {
        onSuccess: async ({ chatResult, lang, conversationId }) => {
          flushSync(() => {
            updateCurrentHistory((h) => ({
              ...h,
              conversationId,
              updatedAt: new Date().toISOString(),
              messages: [
                ...h.messages,
                { role: "assistant", content: chatResult.message, id: crypto.randomUUID() },
              ],
            }));
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
            updateCurrentHistory((h) => ({ ...h, name: title }));
            try {
              await updateConversationTitle(conversationId, userIdRef.current, title);
            } catch (e) {
              console.error("タイトル更新に失敗しました:", e);
            }
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
      { id: newId, conversationId: undefined, name: "新しいチャット", updatedAt: newId, messages: [] },
      ...prev,
    ]);
    setCurrentHistoryId(newId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return {
    histories,
    currentHistoryId,
    setCurrentHistoryId,
    currentHistory,
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
  };
}
