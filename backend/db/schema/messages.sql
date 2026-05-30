CREATE TABLE messages (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL,
    role            TEXT        NOT NULL,
    content         TEXT        NOT NULL DEFAULT '',
    position        INT         NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_pkey            PRIMARY KEY (id),
    CONSTRAINT chk_role_values          CHECK (role IN ('user', 'assistant')),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX idx_messages_conversation_position
    ON messages (conversation_id, position);

COMMENT ON TABLE messages
    IS '会話に紐づくメッセージ';

COMMENT ON COLUMN messages.id
    IS '一意識別子';
COMMENT ON COLUMN messages.conversation_id
    IS '所属するconversationsテーブルのID';
COMMENT ON COLUMN messages.role
    IS 'ユーザのメッセージの場合はuser、生成AIのメッセージの場合はassistant';
COMMENT ON COLUMN messages.content
    IS 'メッセージ本文';
COMMENT ON COLUMN messages.position
    IS '会話内での順序';
COMMENT ON COLUMN messages.created_at
    IS '作成日時';
COMMENT ON COLUMN messages.updated_at
    IS '更新日時';
