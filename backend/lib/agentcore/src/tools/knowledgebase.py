"""技術ブログの内容をKnowledgeBaseから取得するツール"""

import os
import urllib
import urllib.parse

import boto3
from custom_logging import get_logger  # ty:ignore[unresolved-import]
from pydantic import BaseModel
from strands import tool

KNOWLEDGE_BASE_ID = os.environ["KNOWLEDGE_BASE_ID"]
REGION = "ap-northeast-1"

bedrock_agent_runtime_client = boto3.client("bedrock-agent-runtime", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)

logger = get_logger()


class TechBlogContent(BaseModel):
    """Technical blog content retrieved from the knowledgebase, including the S3 URI and the content of the article.

    Attributes:
        s3_uri (str): The S3 URI of the technical blog article.
        content (str): The content of the technical blog article.

    """  # noqa: E501

    s3_uri: str
    content: str


@tool
def get_tech_blog_content(query: str) -> TechBlogContent:
    """Retrieve technical blog articles from the knowledgebase based on the given user query.

    Args:
        query (str): The search query or question input by the user.

    Returns:
        TechBlogContent: A technical blog article relevant to the user's query, containing the S3 URI and the content of the article.

    """  # noqa: E501
    paginator = bedrock_agent_runtime_client.get_paginator("retrieve")
    response_iterator = paginator.paginate(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        retrievalConfiguration={
            # ファイルの内容を直接返却するので1件のS3 URIのみ取得すれば十分
            "vectorSearchConfiguration": {
                "numberOfResults": 1,
            },
        },
        retrievalQuery={
            "text": query,
        },
    )

    for page in response_iterator:
        # チャンクを直接返却せず、S3に保存されたファイルの内容を取得して返却
        # results.extend(result["content"]["text"] for result in page["retrievalResults"])  # noqa: E501, ERA001
        for result in page["retrievalResults"]:
            s3_uri = result["location"]["s3Location"]["uri"]
            bucket, key = s3_uri_parse(s3_uri)
            response = s3_client.get_object(Bucket=bucket, Key=key)
            content = response["Body"].read().decode("utf-8")
            logger.info("Retrieved content from S3 URI: %s", s3_uri)
            return TechBlogContent(s3_uri=s3_uri, content=content)
    return TechBlogContent(s3_uri="", content="")


def s3_uri_parse(s3_uri: str) -> tuple[str, str]:
    """Parse the given S3 URI and extract the bucket name and key."""
    try:
        logger.info("Parsing S3 URI: %s", s3_uri)
        parsed_uri = urllib.parse.urlparse(s3_uri)
        bucket = parsed_uri.netloc
        key = urllib.parse.unquote_plus(parsed_uri.path.lstrip("/"))
    except Exception:
        logger.exception("Failed to parse S3 URI: %s", s3_uri)
        raise
    return bucket, key
