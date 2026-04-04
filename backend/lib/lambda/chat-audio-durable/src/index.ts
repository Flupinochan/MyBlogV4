import { Logger } from "@aws-lambda-powertools/logger";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  DurableContext,
  withDurableExecution,
} from "@aws/durable-execution-sdk-js";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable "${key}" is not set`);
  }
  return value;
}

const AGENT_RUNTIME_ARN = getEnv("AGENT_RUNTIME_ARN");

const logger = new Logger({ serviceName: "chat-audio-durable" });

export const handler = withDurableExecution(
  async (event: unknown, context: DurableContext) => {
    logger.addContext(context);
    logger.logEventIfEnabled(event);

    logger.info("Durable function started");

    const result = await context.step(async () => {
      const sessionId = context.executionContext.durableExecutionArn;
      const input_text = "こんにちは、世界！";
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

    logger.info("Durable function step completed", { result });
    return result;
  },
);
