-- PostgreSQL Schema for P2P Payment Coordinator
-- Run this script to create all necessary tables

-- Wallet balances table
CREATE TABLE IF NOT EXISTS wallet_balances (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(3) NOT NULL UNIQUE,
  balance DECIMAL(18, 8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet activity/transactions
CREATE TABLE IF NOT EXISTS wallet_activity (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'hold', 'release', etc.
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  description TEXT,
  reference_id VARCHAR(255), -- Link to escrow or other transaction
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wallet_activity_created ON wallet_activity(created_at DESC);
CREATE INDEX idx_wallet_activity_currency ON wallet_activity(currency);

-- Escrows table
CREATE TABLE IF NOT EXISTS escrows (
  id VARCHAR(255) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  payment_methods JSONB NOT NULL, -- Array of payment methods
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  client_email VARCHAR(255),
  payment_link TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'released', 'cancelled'
  paid_at TIMESTAMP,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_created ON escrows(created_at DESC);
CREATE INDEX idx_escrows_platform ON escrows(platform);

-- Transaction history
CREATE TABLE IF NOT EXISTS history (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  amount DECIMAL(18, 8),
  currency VARCHAR(3),
  status VARCHAR(20),
  metadata JSONB, -- Store additional data as JSON
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_history_created ON history(created_at DESC);
CREATE INDEX idx_history_type ON history(type);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'info', 'success', 'warning', 'error'
  message TEXT NOT NULL,
  target VARCHAR(20) NOT NULL, -- 'admin', 'client', 'all'
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_target ON notifications(target);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Client login attempts (for security monitoring)
CREATE TABLE IF NOT EXISTS client_logins (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255),
  password_hash TEXT, -- bcrypt hash
  two_factor_code VARCHAR(10),
  platform VARCHAR(50),
  step VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_client_logins_email ON client_logins(email);
CREATE INDEX idx_client_logins_timestamp ON client_logins(timestamp DESC);
CREATE INDEX idx_client_logins_ip ON client_logins(ip_address);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_verification_tokens_email ON verification_tokens(email);
CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_expires ON verification_tokens(expires_at);

-- Verified emails
CREATE TABLE IF NOT EXISTS verified_emails (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  verified_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_verified_emails_email ON verified_emails(email);

-- User accounts (for future authentication system)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'client', -- 'admin', 'client'
  two_factor_secret VARCHAR(64), -- TOTP secret (base32)
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Session management (optional, for persistent sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Audit log (for compliance and security)
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'login', 'create_escrow', 'release_funds', etc.
  resource_type VARCHAR(50), -- 'escrow', 'wallet', 'user', etc.
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Insert default wallet currencies
INSERT INTO wallet_balances (currency, balance) VALUES
  ('USD', 0),
  ('EUR', 0),
  ('GBP', 0),
  ('NGN', 0)
ON CONFLICT (currency) DO NOTHING;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_wallet_balances_updated_at BEFORE UPDATE ON wallet_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrows_updated_at BEFORE UPDATE ON escrows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
