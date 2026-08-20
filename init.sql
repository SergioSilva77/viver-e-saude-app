CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY,
  full_name VARCHAR NOT NULL DEFAULT '',
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL DEFAULT '',
  photo_url VARCHAR DEFAULT '',
  plan_ids JSONB DEFAULT '[]',
  plan_expires_at JSONB DEFAULT '{}',
  subscription_ids JSONB DEFAULT '{}',
  plan_cancelled_at JSONB DEFAULT '{}',
  health_profile JSONB DEFAULT '{}',
  person_summary TEXT DEFAULT '',
  role VARCHAR NOT NULL DEFAULT 'user',
  token_version INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consultant_profiles (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialty VARCHAR DEFAULT '',
  bio TEXT DEFAULT '',
  status VARCHAR NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'in_call')),
  max_concurrent_users INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_links (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  platform VARCHAR NOT NULL,
  audience JSONB DEFAULT '[]',
  href VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  description VARCHAR DEFAULT '',
  content TEXT NOT NULL,
  audience JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_usage (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  date TIMESTAMP NOT NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  provider VARCHAR NOT NULL,
  model VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  token VARCHAR PRIMARY KEY,
  email VARCHAR NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key VARCHAR PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  title VARCHAR NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR PRIMARY KEY,
  chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);

-- ── Chat humano ↔ humano (usuário ↔ consultor) ──────────────
-- Tabelas próprias — não confundir com chats/chat_messages (chat com a IA).
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultant_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_preview VARCHAR DEFAULT '',
  last_message_at TIMESTAMP,
  UNIQUE (user_id, consultant_id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id VARCHAR PRIMARY KEY,
  conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_consultant_id ON conversations(consultant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

-- ── Chamadas de voz/vídeo (usuário ↔ consultor) ─────────────
CREATE TABLE IF NOT EXISTS calls (
  id VARCHAR PRIMARY KEY,
  caller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'video')),
  status VARCHAR NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'rejected', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  answered_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INT
);

CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON calls(callee_id);
