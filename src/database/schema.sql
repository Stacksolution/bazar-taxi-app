-- ============================================================
--  BazarTaxiApp  –  Database Schema
--  Run once on a fresh MySQL instance.
-- ============================================================

CREATE DATABASE IF NOT EXISTS bazar_taxi_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bazar_taxi_db;

-- ------------------------------------------------------------
--  users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  uuid            CHAR(36)          NOT NULL UNIQUE,        -- public-safe ID
  name            VARCHAR(100)      NOT NULL,
  email           VARCHAR(180)      NOT NULL UNIQUE,
  phone           VARCHAR(20)           NULL,
  password_hash   VARCHAR(255)      NOT NULL,
  role            ENUM('customer','driver','admin') NOT NULL DEFAULT 'customer',
  avatar_url      VARCHAR(512)          NULL,

  -- ── Socket / presence ──────────────────────────────────────
  user_socket_id  VARCHAR(100)          NULL DEFAULT NULL,  -- current Socket.IO socket id
  user_is_online  TINYINT(1)        NOT NULL DEFAULT 0,     -- 1 = online, 0 = offline
  last_seen_at    DATETIME              NULL DEFAULT NULL,   -- set on disconnect

  -- ── Timestamps ────────────────────────────────────────────
  created_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME              NULL DEFAULT NULL,  -- soft delete

  PRIMARY KEY (id),
  INDEX idx_uuid          (uuid),
  INDEX idx_email         (email),
  INDEX idx_socket_id     (user_socket_id),
  INDEX idx_is_online     (user_is_online)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
--  socket_logs  (audit trail of every connect / disconnect)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS socket_logs (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  socket_user_id     BIGINT UNSIGNED      NULL,           -- NULL when user isn't authenticated
  socket_socket_id   VARCHAR(100)     NOT NULL,
  socket_event       ENUM('connected','disconnected','reconnected') NOT NULL,
  socket_ip_address  VARCHAR(45)          NULL,           -- supports IPv6
  socket_user_agent  VARCHAR(512)         NULL,
  socket_reason      VARCHAR(255)         NULL,           -- disconnect reason from Socket.IO
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_sl_user_id   (socket_user_id),
  INDEX idx_sl_socket_id (socket_socket_id),
  INDEX idx_sl_event     (socket_event),
  CONSTRAINT fk_sl_user FOREIGN KEY (socket_user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
--  Seed: demo users  (password = "password123"  –  bcrypt)
-- ------------------------------------------------------------
INSERT IGNORE INTO users (uuid, name, email, phone, password_hash, role) VALUES
  (UUID(), 'Ali Ahmed',    'ali@example.com',    '+92-300-0000001', '$2b$10$placeholder_hash_1', 'customer'),
  (UUID(), 'Usman Driver', 'usman@example.com',  '+92-300-0000002', '$2b$10$placeholder_hash_2', 'driver'),
  (UUID(), 'Super Admin',  'admin@example.com',  '+92-300-0000003', '$2b$10$placeholder_hash_3', 'admin');
