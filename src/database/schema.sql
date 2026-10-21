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

CREATE TABLE IF NOT EXISTS socket_chat_rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    room_booking_id INT UNSIGNED NOT NULL,
    room_owner_id INT UNSIGNED NOT NULL,
    -- Kept as a compatibility alias for older integrations.
    room_user_id INT UNSIGNED NOT NULL,
    room_status ENUM('active', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_booking_room (room_booking_id),
    INDEX idx_room_owner (room_owner_id)
);

CREATE TABLE IF NOT EXISTS socket_chat_participants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    chat_room_id INT UNSIGNED NOT NULL,
    participant_user_id INT UNSIGNED NOT NULL,
    participant_status ENUM('active', 'left') NOT NULL DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_participant (chat_room_id, participant_user_id),
    INDEX idx_participant (participant_user_id),
    FOREIGN KEY (chat_room_id) REFERENCES socket_chat_rooms(id) ON DELETE CASCADE
);

-- 2. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS socket_chat_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    chat_room_id INT UNSIGNED NOT NULL,
    chat_sender_id INT UNSIGNED NOT NULL,
    chat_conversation_user_id INT UNSIGNED NOT NULL,
    chat_message TEXT NULL,
    chat_message_type ENUM('text', 'image', 'file', 'audio') DEFAULT 'text',
    chat_attachment_url VARCHAR(500) NULL,
    -- Status tracking
    chat_message_status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
    chat_delivered_at TIMESTAMP NULL DEFAULT NULL,
    chat_read_at TIMESTAMP NULL DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Query performance Optimization for Unread Count & Receipts
    INDEX idx_room_status (chat_room_id, chat_message_status),
    INDEX idx_sender (chat_sender_id),
    INDEX idx_conversation (chat_room_id, chat_conversation_user_id),
    FOREIGN KEY (chat_room_id) REFERENCES socket_chat_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS socket_message_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_message_id INT NOT NULL,
    receipt_user_id INT NOT NULL,
    receipt_status ENUM('delivered', 'read') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_message_id) REFERENCES socket_chat_messages(id) ON DELETE CASCADE,
    UNIQUE KEY uk_msg_user (receipt_message_id, receipt_user_id)
);
