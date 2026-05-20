export interface TextChatRequest {
  message: string;
}

export interface TextChatResponse {
  message: string;
}

export interface VoiceChatRequest {
  message: string;
}

export interface VoiceChatResponse {
  message: string;
  voicePath: string;
}

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
