---
name: create-diagram
description: Generate or update an AWS architecture diagram for this repo's CDK backend (backend/lib/**) as a D2 diagram + PNG. Use when the user asks to create, update, regenerate, or fix an architecture/system/infrastructure diagram.
---

# Create Diagram

Turns CDK stack code into a reviewable architecture diagram. The pipeline never writes D2
by hand from scratch: **CDK code -> `structure.yaml` (facts) -> `conventions.md` (style) ->
`diagram.d2` -> `diagram.png`**. Structure and style are kept in separate files on purpose —
structure is regenerated from code every run, conventions accumulate from user feedback
across runs. A diagram is rarely right on the first render; expect to loop step 5 a few
times.

Each diagram lives under `docs/diagrams/<view>/` where `<view>` is a short slug for one
functional area (e.g. `voicevox`, `opensearch`, `hosting`). Don't build one repo-wide
diagram — CDK stacks here span several unrelated features and a single graph gets
unreadable fast.

Make a todo list for the steps below and work through them in order.

## 1. Determine the view

If the user named a view or a feature, use that. Otherwise inspect the CDK app
entrypoints (`backend/bin/backend.ts`, `backend/bin/env/*.ts`) to see which stacks are
actually instantiated, group them by feature directory (e.g. everything under
`backend/lib/lambda/voicevox/`), and ask the user which one to diagram.

Check whether `docs/diagrams/<view>/` already exists — if so this is an update, not a
fresh extraction; read the existing `structure.yaml` and `conventions.md` first.

## 2. Extract structure.yaml

Read `references/structure-schema.md` for the schema and the node/edge extraction rules,
then read the CDK stack file(s) for the chosen view and write/update
`docs/diagrams/<view>/structure.yaml`.

Only include stacks reachable from a CDK app entrypoint. If a stack file under
`backend/lib/` is never instantiated from `backend/bin/*.ts`, it isn't deployed — leave it
out and tell the user you excluded it.

## 3. Confirm conventions.md

If `docs/diagrams/<view>/conventions.md` doesn't exist yet, create it from
`references/d2-conventions.md` (copy verbatim as the starting point). If it exists, read
it — it holds accumulated style feedback from previous runs and takes priority over the
defaults in `references/d2-conventions.md`.

## 4. Generate the D2 file

Using `structure.yaml` + `conventions.md`, write `docs/diagrams/<view>/diagram.d2`.

## 5. Render and self-check

```bash
cd .claude/skills/create-diagram/scripts && npm install --no-audit --no-fund # first run only
node .claude/skills/create-diagram/scripts/render.mjs \
  docs/diagrams/<view>/diagram.d2 docs/diagrams/<view>/diagram.png
```

Read the rendered `diagram.png` with the Read tool and check it: no overlapping nodes,
labels not truncated, edges going where they should. If a D2 compile error is printed,
fix the `.d2` syntax and rerun. If the layout is correct but doesn't match how the user
wants it read, that's a `conventions.md` change (see the workflow note in
`references/d2-conventions.md`) followed by regenerating the `.d2` and re-rendering — not
a one-off hand edit of the `.d2` file, since the next extraction would just overwrite it.

Iterate on this step until the image looks right before reporting back.

## 6. Report

Tell the user which files were written under `docs/diagrams/<view>/` and show/describe
the final diagram. Don't commit unless asked.
