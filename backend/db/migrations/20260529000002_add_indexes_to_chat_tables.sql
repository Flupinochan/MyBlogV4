CREATE INDEX IF NOT EXISTS idx_conversations_user_id
    ON conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at
    ON conversations (user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_position
    ON messages (conversation_id, position);
