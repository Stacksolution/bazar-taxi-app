-- Chat identity migration: remove all role/type columns from chat.
-- Run after a database backup. New installations should run schema.sql.
USE bazar_taxi_db;

-- Rooms: owner is identified only by room_owner_id.
ALTER TABLE socket_chat_rooms
  DROP INDEX idx_room_owner,
  DROP COLUMN room_owner_type;

-- Participants: one membership per (room, user id).
ALTER TABLE socket_chat_participants
  DROP INDEX uk_room_participant,
  DROP INDEX idx_participant,
  DROP COLUMN participant_user_type,
  ADD UNIQUE KEY uk_room_participant (chat_room_id, participant_user_id),
  ADD INDEX idx_participant (participant_user_id);

-- Messages: sender and conversation target are IDs only.
ALTER TABLE socket_chat_messages
  DROP INDEX idx_sender,
  DROP INDEX idx_conversation,
  DROP COLUMN chat_sender_type,
  DROP COLUMN chat_conversation_user_type,
  ADD INDEX idx_sender (chat_sender_id),
  ADD INDEX idx_conversation (chat_room_id, chat_conversation_user_id);

-- Receipts: one receipt per (message, user id).
ALTER TABLE socket_message_receipts
  DROP INDEX uk_msg_user,
  DROP COLUMN receipt_user_type,
  ADD UNIQUE KEY uk_msg_user (receipt_message_id, receipt_user_id);
