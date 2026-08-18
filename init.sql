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
  person_summary TEXT DEFAULT ''
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
