/**
 * BazarTaxiApp – Socket.IO Test Client
 * Connects using query params: user_type, user_id, guest_id
 *
 * Run:  node test-client.js
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:4000';

// ── Test as a driver (user_id=2 must exist in DB with role=driver) ──
const socket = io(SERVER_URL, {
  query: {
    user_type : 'driver',
    user_id   : '2',
    guest_id  : '0',
  },
  transports: ['websocket'],
  reconnection: true,
});

// ── Connection events ────────────────────────────────────────────────
socket.on('connect', () => {
  console.log(`\n✅ Connected!  socket.id = ${socket.id}\n`);

  // Ask for online users list
  socket.emit('presence:get_online_users', {}, (res) => {
    console.log('📋 Online users:', JSON.stringify(res, null, 2));
  });
});

socket.on('presence:user_online', (data) => {
  console.log('🟢 User online :', data);
});

socket.on('presence:user_offline', (data) => {
  console.log('🔴 User offline:', data);
});

socket.on('disconnect', (reason) => {
  console.log('\n❌ Disconnected:', reason);
});

socket.on('connect_error', (err) => {
  console.error('\n🚫 Connection error:', err.message);
});

// Disconnect after 15 seconds
setTimeout(() => {
  console.log('\n⏱  Disconnecting after timeout…');
  socket.disconnect();
}, 15_000);
