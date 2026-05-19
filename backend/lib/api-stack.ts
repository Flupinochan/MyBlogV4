import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface ApiStackProps extends cdk.StackProps {
  domainName: string;
  apiPath: string;
  isProd: boolean;
  openSearchApiLambdaName: string;
  voicevoxLambdaName: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.logGroup = new logs.LogGroup(this, "ApiLogGroup", {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, "Api", {
      restApiName: `MyBlogV4-${props.domainName}`,
      cloudWatchRole: true,
      defaultCorsPreflightOptions: {
        allowOrigins: [
          `https://${props.domainName}`,
          props.isProd ? undefined : "http://127.0.0.1:4321",
        ].filter(Boolean) as string[],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
      deployOptions: {
        stageName: props.apiPath,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          this.logGroup,
        ),
        accessLogFormat: apigateway.AccessLogFormat.clf(),
        throttlingRateLimit: 10,
        throttlingBurstLimit: 10,
      },
    });

    const responseHeaders = {
      "Access-Control-Allow-Origin": "'*'",
      "Access-Control-Allow-Methods": "'*'",
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    };
    this.api.addGatewayResponse("UnauthorizedResponse", {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders,
    });
    this.api.addGatewayResponse("AccessDeniedResponse", {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders,
    });
    this.api.addGatewayResponse("Default4xxResponse", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders,
    });
    this.api.addGatewayResponse("Default5xxResponse", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders,
    });

    const blogSearchLambda = lambda.Function.fromFunctionName(
      this,
      "BlogSearchLambda",
      props.openSearchApiLambdaName,
    );

    const voicevoxLambda = lambda.Function.fromFunctionName(
      this,
      "VoicevoxLambda",
      props.voicevoxLambdaName,
    );

    const v1 = this.api.root.addResource("v1");
    const fastapi = v1.addResource("fastapi");
    const voicevoxIntegration = new apigateway.LambdaIntegration(voicevoxLambda, { proxy: true });
    fastapi.addResource("health").addMethod("GET", voicevoxIntegration);
    const chat = fastapi.addResource("chat");
    chat.addMethod("POST", voicevoxIntegration);
    chat.addResource("voice").addMethod("POST", voicevoxIntegration);

    this.api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(blogSearchLambda, {
        proxy: true,
      }),
      anyMethod: true,
    });
  }
}
