# Default D2 drawing conventions

This is the starting content for a new view's `conventions.md`. Copy it verbatim when a
view is created for the first time, then let the user's feedback change it over time —
treat it as living documentation of "how this repo likes its diagrams drawn", not a fixed
spec. Re-read the view's own `conventions.md` (not this file) on every subsequent run.

## Shape by resource kind

AWS resources get the official AWS Architecture Icon via `shape: image` + `icon:`, not a
generic rectangle/cylinder — e.g.:

```d2
voicevox_lambda: "synthesizeVoice" {
  shape: image
  icon: https://icons.terrastruct.com/aws%2FCompute%2FAWS-Lambda_Lambda-Function_light-bg.svg
}
```

`render.mjs` fetches and inlines the icon at render time (see its top-of-file comment), so
the plain `icons.terrastruct.com` URL is all that belongs in the `.d2` file — don't
hand-embed a data URI, D2's own line-length limit rejects it.

Icon files come in two families and must not be mixed within one diagram:
**"service" icons** — a solid colored square, filename is just `<Service>_light-bg.svg`
(or, if that exact file 404s, `<Service>.svg` with no suffix) — and **"resource" icons** —
outline-only with no fill, filename has an extra descriptor like `_Bucket_light-bg.svg` or
`_Lambda-Function_light-bg.svg`. Always use the solid "service" family so every node reads
consistently at a glance; render a candidate once with `render.mjs` and eyeball it before
trusting a new URL, since AWS's own naming isn't consistent between services.

| CDK construct namespace | icon URL (path after `icons.terrastruct.com/`) |
|---|---|
| `apigateway.*` | `aws%2FMobile%2FAmazon-API-Gateway_light-bg.svg` |
| `lambda.*` | `aws%2FCompute%2FAWS-Lambda_light-bg.svg` |
| `s3.*` | `aws%2FStorage%2FAmazon-Simple-Storage-Service-S3.svg` |
| `dynamodb.*` | `aws%2FDatabase%2FAmazon-DynamoDB_light-bg.svg` |
| `ecr.*` | `aws%2FCompute%2FAmazon-EC2-Container-Registry_light-bg.svg` |
| `cloudfront.*` | `aws%2FNetworking%20&%20Content%20Delivery%2FAmazon-CloudFront_light-bg.svg` |

For a construct not in this table, look it up at https://icons.terrastruct.com (search the
AWS service name, right-click the icon to copy its URL), confirm it's the solid-square
family by rendering it, and add the mapping here once confirmed so later runs don't have
to look it up again. If no suitable icon exists, or the resource is external to AWS (e.g.
an Aiven OpenSearch cluster, a third-party API), fall back to a plain shape (`rectangle`,
`cylinder`, `cloud`, `person`, ...) — icons are required for AWS resources this repo
actually deploys, optional for everything else.

## Grouping

`structure.yaml`'s `group` field is metadata, not an instruction to draw a box. Default to
flat, ungrouped nodes — a D2 container renders as a labeled, filled/bordered region, which
adds visual noise for little benefit on a small graph. Only wrap nodes in a container when
the view has enough nodes/groups that the box genuinely aids scanning, and even then, ask
the user first since a container's default fill can hurt readability:

```d2
voicevox: "voicevox" {
  voicevox_api_gateway: "voicevox API" { shape: rectangle }
  voicevox_lambda: "synthesizeVoice" { shape: rectangle }
}
```

## Layout & style defaults

- Top-to-bottom (`dagre`, the default `render.mjs` already passes as a compile option),
  unless the graph is wide and shallow, in which case ask the user whether left-to-right
  (`direction: right`, written inside the `.d2` file) reads better. Do not write
  `layout: dagre` as a top-level line in the `.d2` file itself — D2 has no bare top-level
  `layout` keyword, so it gets parsed as a shape named "dagre" instead of configuring the
  layout engine.
- Edge labels are short verbs describing the runtime call (`invoke`, `read/write`,
  `publish`), matching `edges[].label` from `structure.yaml`.
- Don't hand-pick colors or fonts unless the user asks — the D2 default theme is the
  baseline until conventions.md says otherwise.

## Workflow for changing conventions

When the user gives feedback on the rendered image ("this should be grouped", "make
Lambda functions orange", "put the DB on the right"), translate that feedback into a
durable rule and append it to that view's `conventions.md` before re-rendering, so the
next run doesn't need to be told again.
