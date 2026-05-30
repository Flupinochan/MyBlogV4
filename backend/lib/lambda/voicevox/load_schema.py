"""Atlas SQLAlchemy Providerを使用してDDLを自動生成するスクリプト"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from atlas_provider_sqlalchemy.ddl import print_ddl
from service.models import ConversationOrm, MessageOrm

# ORMを追加したら追記すること
print_ddl("postgresql", [ConversationOrm, MessageOrm])
