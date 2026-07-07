# structure.yaml schema

`structure.yaml` is the intermediate representation between the CDK source and the rendered
diagram. Extract it from code first; never hand-author the D2 file directly.

```yaml
view: voicevox                      # matches the directory name under docs/diagrams/
stacks:                             # CDK stack files this view was extracted from
  - backend/lib/lambda/voicevox/voicevox-apigateway-stack.ts
  - backend/lib/lambda/voicevox/voicevox-api-lambda-stack.ts
  - backend/lib/lambda/voicevox/voicevox-bucket-stack.ts
  - backend/lib/lambda/voicevox/voicevox-ecr-stack.ts
nodes:
  - id: voicevox_api_gateway         # unique within this file
    construct: apigateway.RestApi   # CDK L2/L3 construct class, for traceability
    name: voicevox API
    group: voicevox                 # optional, used for D2 containers/layers
  - id: voicevox_lambda
    construct: lambda.DockerImageFunction
    name: synthesizeVoice
    group: voicevox
  - id: voicevox_bucket
    construct: s3.Bucket
    name: audio output bucket
    group: voicevox
edges:
  - from: voicevox_api_gateway
    to: voicevox_lambda
    label: invoke
  - from: voicevox_lambda
    to: voicevox_bucket
    label: put audio
```

## Node id rules

- An id must be unique within one `structure.yaml`.
- If the same physical AWS resource appears in more than one view (e.g. a shared bucket
  referenced by two stacks), reuse the exact same id in both files. This keeps diagrams
  consistent if views are ever merged or cross-linked.
- Derive ids from the CDK construct's logical variable name (snake_case), not from the
  display name, so re-running extraction on unchanged code produces the same ids.

## Discovering nodes and edges from CDK code

- Nodes: look for `new <namespace>.<Construct>(...)` calls for AWS L2/L3 constructs
  (`lambda.Function`, `lambda.DockerImageFunction`, `apigateway.RestApi`, `s3.Bucket`,
  `dynamodb.Table`, `aoss.CfnCollection`, etc.). Skip helper/plumbing constructs that have
  no architectural meaning (e.g. `iam.Role`, `Asset`) unless the user asks to show them.
  Only follow stacks that are actually instantiated from a CDK app entrypoint
  (`backend/bin/*.ts`) — code that exists but is never wired into an app (dead/unused
  stacks) should not appear.
- Edges: look for permission grants (`grantInvoke`, `grantReadWrite`, `grantPut`, ...),
  explicit event sources (`addEventSource`, `S3EventSource`, ...), environment variables
  that reference another resource's ARN/URL, and API Gateway integrations
  (`LambdaIntegration`). The verb used for the edge label should describe the runtime
  interaction (`invoke`, `read/write`, `publish`), not the CDK API name.
