"""技術ブログの内容をKnowledgeBaseから取得するツール"""

import os

import boto3
from strands import tool

KNOWLEDGE_BASE_ID = os.environ["KNOWLEDGE_BASE_ID"]
EMBEDDING_MODEL_ARN = os.environ["EMBEDDING_MODEL_ARN"]
REGION = "ap-northeast-1"

bedrock_agent_runtime_client = boto3.client("bedrock-agent-runtime", region_name=REGION)


@tool
def get_tech_blog_content(query: str) -> list[str]:
    """Retrieve technical blog articles from the knowledgebase based on the given user query.

    Args:
        query (str): The search query or question input by the user.

    Returns:
        list[str]: A list of technical blog articles matching the query.

    """  # noqa: E501
    paginator = bedrock_agent_runtime_client.get_paginator("retrieve")
    response_iterator = paginator.paginate(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        retrievalConfiguration={
            "vectorSearchConfiguration": {
                "numberOfResults": 10,
            },
        },
        retrievalQuery={
            "text": query,
            "type": "TEXT",
        },
    )

    results: list[str] = []
    for page in response_iterator:
        results.extend(result["content"]["text"] for result in page["retrievalResults"])
    return results
