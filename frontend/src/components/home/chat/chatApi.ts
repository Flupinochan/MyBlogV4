/// <reference types="dom-chromium-ai" />

import createClient from "openapi-fetch";
import createQueryClient from "openapi-react-query";
import type { components, paths } from "../../../types/api-voicevox.generated";

export type ChatRequest = components["schemas"]["ChatRequest"];
export type TextChatResponse = components["schemas"]["ChatResponse"];
export type VoiceChatResponse = components["schemas"]["VoiceChatResponse"];
export type ConversationResponse =
  components["schemas"]["ConversationResponse"];

const client = createClient<paths>({ baseUrl: "/voicevox-api" });
export const $api = createQueryClient(client);

export async function detectLanguage(text: string): Promise<string> {
  const availability = await LanguageDetector.availability();
  if (availability === "unavailable")
    throw new Error("LanguageDetector is unavailable");
  const detector = await LanguageDetector.create();
  const results = await detector.detect(text);
  const detected = results[0]?.detectedLanguage;
  if (!detected) throw new Error("Language detection failed");
  return detected;
}

const summarizerOptions: SummarizerCreateOptions = {
  expectedInputLanguages: ["ja", "en"],
  outputLanguage: "ja",
  type: "headline",
  length: "short",
  format: "plain-text",
  preference: "auto",
};

export async function generateChatTitle(
  text: string,
  detectedLang?: string,
): Promise<string> {
  const options = detectedLang
    ? {
        ...summarizerOptions,
        expectedInputLanguages: [detectedLang],
        outputLanguage: detectedLang,
      }
    : summarizerOptions;
  const availability = await Summarizer.availability(options);
  if (availability === "unavailable")
    throw new Error("Summarizer is unavailable");
  const summarizer = await Summarizer.create(options);
  return summarizer.summarize(text);
}

export async function sendTextMessage(
  request: ChatRequest,
): Promise<TextChatResponse> {
  const { data, error } = await client.POST("/v1/chat", {
    body: request,
  });
  if (error) throw new Error("chat request failed");
  return data;
}

export async function sendVoiceMessage(
  request: ChatRequest,
): Promise<VoiceChatResponse> {
  const { data, error } = await client.POST("/v1/chat/voice", {
    body: request,
  });
  if (error) throw new Error("voice chat request failed");
  return data;
}

export async function getConversations(
  userId: string,
): Promise<ConversationResponse[]> {
  const { data, error } = await client.GET("/v1/conversations", {
    params: { header: { "x-user-id": userId } },
  });
  if (error) throw new Error("failed to fetch conversations");
  return data ?? [];
}

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string,
): Promise<void> {
  const { error } = await client.PATCH("/v1/conversations/{conversation_id}", {
    params: {
      path: { conversation_id: conversationId },
      header: { "x-user-id": userId },
    },
    body: { title },
  });
  if (error) throw new Error("failed to update conversation title");
}
