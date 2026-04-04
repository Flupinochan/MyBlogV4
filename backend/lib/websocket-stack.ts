import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

export class WebsocketStack extends cdk.Stack {
  public readonly websocketIntegration: WebSocketLambdaIntegration;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const webSocketApi = new apigwv2.WebSocketApi(this, "WebSocketApi");
    new apigwv2.WebSocketStage(this, "WebSocketStage", {
      webSocketApi,
      stageName: "dev",
      autoDeploy: true,
    });
    // webSocketApi.addRoute("sendMessage", {
    //   integration: new WebSocketLambdaIntegration(
    //     "SendMessageIntegration",
    //     messageHandler,
    //   ),
    // });
  }
}
