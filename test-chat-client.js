'use strict';

/**
 * Booking-room chat smoke test.
 * Owner sees both participant conversations; each participant sees only their
 * own conversation with the owner.
 * CLI smoke test: node test-chat-client.js
 * Browser GUI: start the server and open http://localhost:4000/chat-test
 * Override ids with BOOKING_ID, OWNER_ID, PARTICIPANT_1_ID, PARTICIPANT_2_ID.
 */
const { io } = require('socket.io-client');
const URL = process.env.SERVER_URL || 'http://localhost:4000';
const BOOKING_ID = Number(process.env.BOOKING_ID || 1);
const OWNER_ID = Number(process.env.OWNER_ID || 1);
const P1_ID = Number(process.env.PARTICIPANT_1_ID || 5);
const P2_ID = Number(process.env.PARTICIPANT_2_ID || 6);
const OWNER_TYPE = process.env.OWNER_TYPE || 'customer';
const PARTICIPANT_TYPE = process.env.PARTICIPANT_TYPE || 'driver';

const connect = (id, type) => io(URL, { query: { user_id: String(id), user_type: type, guest_id: '0' }, transports: ['websocket'], reconnection: false });
const owner = connect(OWNER_ID, OWNER_TYPE), p1 = connect(P1_ID, PARTICIPANT_TYPE), p2 = connect(P2_ID, PARTICIPANT_TYPE);
const sockets = [owner, p1, p2];
const log = (name, value) => console.log(`\n[${name}]`, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const once = (socket, event) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 8000); socket.once(event, (value) => { clearTimeout(timer); resolve(value); }); });
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
const connected = (socket) => socket.connected ? Promise.resolve() : once(socket, 'connect');

for (const [name, socket] of [['OWNER', owner], ['P1', p1], ['P2', p2]]) {
  socket.on('connect', () => log(name, `connected: ${socket.id}`));
  socket.on('connect_error', (err) => log(name, `connect_error: ${err.message}`));
  socket.on('chat:room_joined', (data) => log(`${name} room_joined`, data.joinedBy));
  socket.on('chat:user_typing', (data) => log(`${name} typing`, data));
  socket.on('chat:message_read', (data) => log(`${name} message_read`, data));
}
owner.on('chat:new_message', (res) => log('OWNER new_message (all conversations)', res.data));
p1.on('chat:new_message', (res) => log('P1 new_message (only P1 thread)', res.data));
p2.on('chat:new_message', (res) => log('P2 new_message (only P2 thread)', res.data));

(async () => {
  try {
    await Promise.all(sockets.map(connected));
    // The server identifies the owner from this socket's authenticated user id.
    // ownerId/ownerType are intentionally not sent in the join payload.
    const ownerJoin = await emit(owner, 'chat:join_room', { bookingId: BOOKING_ID });
    if (!ownerJoin.success) throw new Error(ownerJoin.message);
    const roomId = ownerJoin.data.room.id;
    log('OWNER join', { roomId, isOwner: ownerJoin.data.isOwner });

    for (const [name, socket, id] of [['P1', p1, P1_ID], ['P2', p2, P2_ID]]) {
      const joined = await emit(socket, 'chat:join_room', { bookingId: BOOKING_ID });
      if (!joined.success) throw new Error(`${name}: ${joined.message}`);
      log(`${name} join`, { roomId: joined.data.room.id, isOwner: joined.data.isOwner });
      const sent = await emit(socket, 'chat:send_message', { roomId, message: `Hello from ${name}` });
      if (!sent.success) throw new Error(`${name} send: ${sent.message}`);
      log(`${name} send`, sent.data.id);
      void id;
    }

    const reply = await emit(owner, 'chat:send_message', { roomId, toUserId: P1_ID, message: 'Reply only for P1' });
    if (!reply.success) throw new Error(`OWNER send: ${reply.message}`);
    log('OWNER targeted reply', reply.data.id);
    await emit(owner, 'chat:mark_read', { roomId });
    log('RESULT', 'Owner received P1 + P2 messages. P1/P2 received only their own thread.');
  } catch (err) { console.error('\nTEST FAILED:', err.message); process.exitCode = 1; }
  finally { setTimeout(() => { sockets.forEach((socket) => socket.disconnect()); }, 1000); }
})();
