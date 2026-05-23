/// <reference types="dom-chromium-ai" />

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

import type { components } from "../../../types/api.generated";

export type TextChatRequest = components["schemas"]["ChatRequest"];
export type VoiceChatRequest = components["schemas"]["ChatRequest"];
export type TextChatResponse = components["schemas"]["ChatResponse"];
export type VoiceChatResponse = components["schemas"]["VoiceChatResponse"];

export async function sendTextMessage(
  request: TextChatRequest,
): Promise<TextChatResponse> {
  const response = await fetch("/api/v1/fastapi/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as TextChatResponse;
}

export async function sendVoiceMessage(
  request: VoiceChatRequest,
): Promise<VoiceChatResponse> {
  const response = await fetch("/api/v1/fastapi/chat/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as VoiceChatResponse;
}
