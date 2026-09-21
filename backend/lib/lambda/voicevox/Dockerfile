FROM ghcr.io/astral-sh/uv:0.11.3 AS uv
FROM python:3.13-slim AS builder

ENV UV_COMPILE_BYTECODE=1
ENV UV_NO_INSTALLER_METADATA=1
ENV UV_LINK_MODE=copy

RUN --mount=from=uv,source=/uv,target=/bin/uv \
    --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv export --frozen --no-emit-workspace --no-dev --no-editable -o requirements.txt && \
    uv pip install -r requirements.txt --target /var/task

FROM python:3.13-slim

ARG TARGETARCH

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 /lambda-adapter /opt/extensions/lambda-adapter

ENV PYTHONPATH=/var/task/src:/var/task
ENV PATH=/var/task/bin:$PATH
WORKDIR /var/task

COPY --from=builder /var/task /var/task
COPY src ./src
COPY voicevox ./voicevox
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      rm -rf voicevox/onnxruntime && mv voicevox/onnxruntime-arm64 voicevox/onnxruntime; \
    else \
      rm -rf voicevox/onnxruntime-arm64; \
    fi

CMD ["fastapi", "run", "src/main.py", "--port", "8080"]