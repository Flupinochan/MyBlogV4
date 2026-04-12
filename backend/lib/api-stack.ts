import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface ApiStackProps extends cdk.StackProps {
  domainName: string;
  apiPath: string;
  isProd: boolean;
  chatSessionLambda: lambda.Function;
  chatAudioDurableLambda: lambda.Function;
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
      restApiName: `${props.domainName}-MyBlogV4`,
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

    const v1 = this.api.root.addResource("v1");
    const users = v1.addResource("users");
    const user = users.addResource("{userId}");
    const sessions = user.addResource("sessions");
    const session = sessions.addResource("{sessionId}");
    const messages = session.addResource("messages");

    messages.addMethod(
      "GET",
      new apigateway.LambdaIntegration(props.chatSessionLambda, {
        proxy: true,
      }),
    );

    messages.addMethod(
      "POST",
      new apigateway.LambdaIntegration(props.chatAudioDurableLambda, {
        proxy: true,
      }),
    );
  }
}
