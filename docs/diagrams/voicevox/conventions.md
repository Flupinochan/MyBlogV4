# Drawing conventions — voicevox view

## Shape by resource kind

AWS resources use the official AWS Architecture Icon (`shape: image` + `icon:`), always
the solid-square "service" icon family (not the outline "resource" family — see
`references/d2-conventions.md` for why the two must not be mixed). `render.mjs` inlines
the icon URL as a data URI at render time.

| CDK construct namespace | icon URL (path after `icons.terrastruct.com/`) |
|---|---|
| `apigateway.*` | `aws%2FMobile%2FAmazon-API-Gateway_light-bg.svg` |
| `lambda.*` | `aws%2FCompute%2FAWS-Lambda_light-bg.svg` |
| `s3.*` | `aws%2FStorage%2FAmazon-Simple-Storage-Service-S3.svg` |
| `ecr.*` | `aws%2FCompute%2FAmazon-EC2-Container-Registry_light-bg.svg` |
| `cloudfront.*` | `aws%2FNetworking%20&%20Content%20Delivery%2FAmazon-CloudFront_light-bg.svg` |
| `external` (actors outside AWS) | `shape: person` (no icon) |

## Grouping

Flat, no containers — this view only has 6 nodes, not enough to benefit from a boxed
sub-region, and the box was reviewed as visual noise. Revisit only if the node count grows
substantially.

## Layout & style defaults

- Top-to-bottom (`dagre`, set as a `render.mjs` compile option, not written in the `.d2`
  file — a bare `layout: dagre` line in D2 is parsed as a shape, not layout config).
- Edge labels are short verbs describing the runtime call, matching `edges[].label` from
  `structure.yaml`.
- Don't hand-pick colors or fonts unless the user asks — the D2 default theme is the
  baseline until this file says otherwise.

## Workflow for changing conventions

When the user gives feedback on the rendered image, translate that feedback into a
durable rule and append it here before re-rendering.
