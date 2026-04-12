import { Router } from "@aws-lambda-powertools/event-handler/http";
import { cors } from "@aws-lambda-powertools/event-handler/http/middleware";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
  InvokeAgentRuntimeCommandInput,
} from "@aws-sdk/client-bedrock-agentcore";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { APIGatewayProxyHandlerV2, Context } from "aws-lambda";
import { z } from "zod";

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
const DOMAIN_NAME = getEnv("DOMAIN_NAME");

// ロガー定義
const logger = new Logger({ serviceName: "chat-audio" });

// クライアント初期化
const bedrockClient = new BedrockAgentCoreClient();
const lambdaClient = new LambdaClient();

// Router初期化
const app = new Router();
app.use(cors({ origin: `https://${DOMAIN_NAME}`, maxAge: 300 }));

// スキーマ定義
const inboundSchema = z.object({
  message: z.string(),
});
const outboundSchema = z.object({
  message: z.string(),
  audioPath: z.string(),
});
const synthesizeVoiceResponseSchema = z.object({
  bucket: z.string(),
  key: z.string(),
});

app.post(
  "/v1/users/:user_id/sessions/:session_id/messages",
  async (reqCtx): Promise<z.infer<typeof outboundSchema>> => {
    const { user_id, session_id } = reqCtx.params;
    const { message } = reqCtx.valid.req.body;
    logger.info("Received request", { user_id, session_id, input_prompt: message });

    // 生成AI (AgentCore) 呼び出し
    const input: InvokeAgentRuntimeCommandInput = {
      runtimeSessionId: session_id,
      agentRuntimeArn: AGENT_RUNTIME_ARN,
      qualifier: "DEFAULT",
      payload: JSON.stringify({ user_id, prompt: message }),
    };
    const command = new InvokeAgentRuntimeCommand(input);
    const agentCoreResponse = await bedrockClient.send(command);
    const agentCoreResponseText =
      await agentCoreResponse.response?.transformToString();
    logger.info("AgentCore function invoked", { agentCoreResponseText });

    // 音声合成 (SynthesizeVoice) 呼び出し
    const invokeCommand = new InvokeCommand({
      FunctionName: SYNTHESIZE_VOICE_FUNCTION_ARN,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ message: agentCoreResponseText }),
    });
    const voiceResponse = await lambdaClient.send(invokeCommand);
    const result = voiceResponse.Payload
      ? JSON.parse(Buffer.from(voiceResponse.Payload).toString())
      : undefined;
    const parsedResult = synthesizeVoiceResponseSchema.safeParse(result);
    if (!parsedResult.success) {
      logger.error("SynthesizeVoice function returned invalid response", {
        result,
        errors: parsedResult.error,
      });
      throw new Error("Invalid response from SynthesizeVoice function");
    }
    logger.info("SynthesizeVoice function invoked", { result });

    const response = {
      message: agentCoreResponseText || "",
      audioPath: parsedResult.data.key,
    };
    logger.info("Returning response", { response });
    return response;
  },
  {
    validation: {
      req: {
        body: inboundSchema,
      },
      res: {
        body: outboundSchema,
      },
    },
  },
);

export const handler: APIGatewayProxyHandlerV2 = async (
  event: unknown,
  context: Context,
) => {
  logger.addContext(context);
  logger.logEventIfEnabled(event);
  return app.resolve(event, context);
};
