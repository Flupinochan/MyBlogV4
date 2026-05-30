CREATE TABLE conversations (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    title      VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_conversations_user_id_created_at
    ON conversations (user_id, created_at DESC);

COMMENT ON TABLE conversations
    IS 'チャットの会話セッション';

COMMENT ON COLUMN conversations.id
    IS '一意識別子';
COMMENT ON COLUMN conversations.user_id
    IS 'オーナーのユーザーID';
COMMENT ON COLUMN conversations.title
    IS 'UI表示用タイトル';
COMMENT ON COLUMN conversations.created_at
    IS '作成日時';
COMMENT ON COLUMN conversations.updated_at
    IS '更新日時';
