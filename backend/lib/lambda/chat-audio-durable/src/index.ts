import { Logger } from "@aws-lambda-powertools/logger";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  DurableContext,
  withDurableExecution,
} from "@aws/durable-execution-sdk-js";

// 環境変数取得
function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable "${key}" is not set`);
  }
  return value;
}
const AGENT_RUNTIME_ARN = getEnv("AGENT_RUNTIME_ARN");
const SYNTHESIZE_VOICE_FUNCTION_ARN = getEnv("SYNTHESIZE_VOICE_FUNCTION_ARN");

// ロガー定義
const logger = new Logger({ serviceName: "chat-audio-durable" });

// Entry Point
export const handler = withDurableExecution(
  async (event: unknown, context: DurableContext) => {
    logger.addContext(context);
    logger.logEventIfEnabled(event);

    logger.info("Durable function started");

    // 生成AI (AgentCore) 呼び出し
    const textResponseOutput = await context.step(async () => {
      const sessionId = context.executionContext.durableExecutionArn;
      const input_text = "こんにちは";
      const client = new BedrockAgentCoreClient();
      const input = {
        runtimeSessionId: sessionId,
        agentRuntimeArn: AGENT_RUNTIME_ARN,
        qualifier: "DEFAULT",
        payload: JSON.stringify({ prompt: input_text }),
      };
      const command = new InvokeAgentRuntimeCommand(input);
      const response = await client.send(command);
      const textResponse = await response.response?.transformToString();
      return textResponse;
    });

    // 音声合成 (SynthesizeVoice) 呼び出し
    const result = await context.invoke("SynthesizeVoiceFunction", SYNTHESIZE_VOICE_FUNCTION_ARN, {
      message: textResponseOutput,
    });

    logger.info("Durable function step completed", { result});
    return result;
  },
);
