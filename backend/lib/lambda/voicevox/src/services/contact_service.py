"""SESを使用してお問い合わせ内容をメール送信するサービス"""

from __future__ import annotations

from typing import TYPE_CHECKING

from aws_lambda_powertools import Logger

if TYPE_CHECKING:
    from mypy_boto3_sesv2 import SESV2Client

logger = Logger(child=True)

SUBJECT = "ブログからお問合せがありました"
CHARSET = "UTF-8"


class ContactService:
    def __init__(self, ses_client: SESV2Client, from_address: str) -> None:
        self._ses_client = ses_client
        self._from_address = from_address

    def send_contact_email(self, name: str, email: str, message: str) -> None:
        body = f"名前: {name}\nメールアドレス: {email}\nお問合せ内容: {message}"
        try:
            self._ses_client.send_email(
                FromEmailAddress=self._from_address,
                Destination={"ToAddresses": [self._from_address]},
                ReplyToAddresses=[email],
                Content={
                    "Simple": {
                        "Subject": {"Data": SUBJECT, "Charset": CHARSET},
                        "Body": {"Text": {"Data": body, "Charset": CHARSET}},
                    },
                },
            )
        except Exception:
            logger.exception("Failed to send contact email")
            raise
