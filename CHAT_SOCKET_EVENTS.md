# Bazar Taxi Chat Socket Events

यह document app developer के लिए है। Backend Socket.IO server `.env` के `PORT` और `SOCKET_CORS_ORIGIN` पर चलता है। Secret values app में expose नहीं करनी हैं।

## 1. Socket connect

```js
import { io } from 'socket.io-client';

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  query: {
    user_id: String(currentUser.id),
    user_type: currentUser.role, // customer या driver
    guest_id: '0'
  }
});
```

`user_type: driver` को server internally `vendor` की तरह store करता है। हर acknowledgement का format यही है:

```json
{ "success": true, "message": "...", "data": {} }
```

Error में `success: false`, `message`, `errors` और `code` आते हैं।

## 2. `chat:join_room` — room create/join

Booking बनते ही booking owner इस event से room create करे। उसी `bookingId` पर केवल एक room बनेगा। बाकी users इसी `bookingId` से join करेंगे।

### Owner request

```js
socket.emit('chat:join_room', {
  bookingId: 12345
}, (response) => {
  if (!response.success) return showError(response.message);

  const { room, history, isOwner } = response.data;
  // room.id को आगे send/history/read events में use करें
});
```

### Participant request

```js
socket.emit('chat:join_room', {
  bookingId: 12345
}, (response) => {
  const roomId = response.data.room.id;
});
```

Rules:

- Owner और participant दोनों के लिए payload केवल `bookingId` (या existing `roomId`) है।
- Owner connected socket के authenticated user id से automatically identify होता है।
- Participant का id और type server socket authentication से लेता है; client payload से identity trust नहीं की जाती।
- Response में उस user के लिए allowed history आती है। Owner को सभी conversations, participant को अपनी conversation मिलती है।

### Server event: `chat:room_joined`

जब कोई दूसरा participant room join करता है, room में मौजूद clients को यह event मिलता है:

```json
{
  "room": { "id": 10, "room_booking_id": 12345, "room_owner_id": 4 },
  "joinedBy": { "userId": 8 },
  "participant": { "participant_user_id": 8 }
}
```

### Server event: `chat:participants_list`

यह event room में मौजूद सभी clients को तब मिलता है जब कोई नया user join करता है।

```json
{
  "roomId": 10,
  "participants": [
    { "userId": 4, "joinedAt": "2026-10-21T10:00:00.000Z", "isOwner": true },
    { "userId": 8, "joinedAt": "2026-10-21T10:02:00.000Z", "isOwner": false }
  ]
}
```

Current list manually लेने के लिए:

```js
socket.emit('chat:get_participants', { roomId: 10 }, (response) => {
  const participants = response.data;
});
```

## 3. `chat:send_message` — message भेजना

### Participant से owner को

```js
socket.emit('chat:send_message', {
  roomId: 10,
  message: 'मैं pickup location पर आ गया हूँ।',
  messageType: 'text'
}, (response) => {
  // response.data.id saved message id है
});
```

Participant का target हमेशा room owner होता है। `toUserId` देने की जरूरत नहीं है।

### Owner से किसी specific participant को

```js
socket.emit('chat:send_message', {
  roomId: 10,
  toUserId: 8,
  message: 'ठीक है, gate पर मिलिए।',
  messageType: 'text'
}, callback);
```

Owner के लिए `toUserId` required है। इससे owner की अलग-अलग participant conversations mix नहीं होंगी।

Attachment के लिए `message` खाली हो सकता है:

```js
{
  roomId: 10,
  message: null,
  messageType: 'image',
  attachmentUrl: 'https://cdn.example.com/photo.jpg'
}
```

### Server event: `chat:new_message`

```json
{
  "success": true,
  "message": "New message",
  "data": {
    "id": 501,
    "chat_room_id": 10,
    "chat_sender_id": 8,
    "chat_conversation_user_id": 4,
    "chat_message": "मैं pickup location पर आ गया हूँ।",
    "chat_message_type": "text",
    "chat_message_status": "sent",
    "created_at": "2026-10-21T10:00:00.000Z"
  }
}
```

Visibility:

- Owner को room के सभी messages मिलेंगे।
- Participant को केवल उसी participant-owner conversation के messages मिलेंगे।
- दूसरे participant को message event नहीं मिलेगा।

## 4. Message status: `sent` → `delivered` → `read`

हर message का status database की `chat_message_status` field में रहता है:

| Status | कब set होता है | Client को क्या करना है |
|---|---|---|
| `sent` | Message database में save हो गया, लेकिन target user का कोई active socket नहीं है। | Pending/sent tick दिखाएँ। |
| `delivered` | Target user का authenticated Socket.IO connection online मिला। Server automatically status update करता है। | `chat:new_message` या `chat:message_delivered` से status update करें। |
| `read` | Target user chat खोलकर/visible messages के लिए `chat:mark_read` भेजता है। | `chat:message_read` के `messageIds` को `read` करें। |

`chat:new_message` target user के personal socket पर भी भेजा जाता है, इसलिए target user ने room join न किया हो तब भी online delivery काम करेगी। Offline user के लिए message पहले `sent` रहेगा; target user के reconnect होते ही server pending messages को `delivered` करके उन्हें personal socket पर replay करता है।

### Delivery event: `chat:message_delivered`

```js
socket.on('chat:message_delivered', (event) => {
  updateMessageStatus(event.messageId, event.status); // delivered
});
```

Payload:

```json
{
  "roomId": 10,
  "messageId": 501,
  "status": "delivered",
  "deliveredBy": { "userId": 4 },
  "deliveredAt": "2026-10-21T10:01:00.000Z"
}
```

Send acknowledgement में भी updated message मिलता है:

```js
socket.emit('chat:send_message', payload, ({ success, data }) => {
  if (success) renderMessage(data.id, data.chat_message_status);
});
```

## 5. `chat:typing_start` — typing शुरू

```js
socket.emit('chat:typing_start', { roomId: 10 });
```

यह event sender को वापस नहीं मिलता; room के बाकी authorized clients को मिलता है।

## 6. `chat:typing_stop` — typing बंद

```js
socket.emit('chat:typing_stop', { roomId: 10 });
```

### Server event: `chat:user_typing`

```json
{
  "roomId": 10,
  "userId": 8,
  "isTyping": true
}
```

## 7. `chat:get_room_history` — पुराने messages

```js
socket.emit('chat:get_room_history', {
  roomId: 10,
  page: 1
}, (response) => {
  const messages = response.data;
});
```

एक page में default 50 messages मिलते हैं। Owner को सभी threads की history और participant को अपनी thread की history मिलेगी।

## 8. `chat:mark_read` — messages read करना

जब chat screen खुल जाए या messages दिखाई दे जाएँ:

```js
socket.emit('chat:mark_read', { roomId: 10 }, (response) => {
  console.log(response.data.markedCount);
});
```

### Server event: `chat:message_read`

```json
{
  "roomId": 10,
  "messageIds": [501, 502],
  "readBy": { "userId": 4 },
  "status": "read",
  "readAt": "2026-10-21T10:05:00.000Z"
}
```

```js
socket.on('chat:message_read', ({ messageIds, status }) => {
  messageIds.forEach((id) => updateMessageStatus(id, status)); // read
});
```

## 9. `chat:leave_room` — room छोड़ना

```js
socket.emit('chat:leave_room', { roomId: 10 }, (response) => {
  // response.success === true
});
```

यह केवल current socket को Socket.IO room से remove करता है। Database participant record delete नहीं होता, इसलिए user बाद में फिर join कर सकता है।

## 10. `chat:get_order_rooms` — booking room लेना

नए flow में इसे `bookingId` के साथ call करें:

```js
socket.emit('chat:get_order_rooms', {
  bookingId: 12345
}, (response) => {
  const rooms = response.data; // एक booking का maximum एक room
});
```

पुराने app clients के लिए `orderId` भी accepted है। New app में `bookingId` ही use करें।

## Recommended app flow

1. Booking create करते समय backend authenticated booking owner के context से `ChatService.createRoom()` call करे।
2. हर driver/partner केवल उसी `bookingId` से `chat:join_room` करे।
3. Room मौजूद होने पर server joining user को participant membership में add करेगा।
4. Participant message भेजते समय केवल `roomId` और `message` भेजे।
5. Owner message भेजते समय `roomId` और `toUserId` भेजे; participant type server membership से resolve होगा।
6. App हमेशा `chat:new_message` listener active रखे।
7. Chat open होने पर `chat:mark_read` call करे।
8. Screen close होने पर `chat:leave_room` call करे।

## Important IDs

- `bookingId`: business booking का id; room इसी के आधार पर unique है।
- `roomId`: database chat room id; message/history/read में required है।
- Room मौजूद नहीं होने पर `chat:join_room` error देगा; join event room create नहीं करता।
- `toUserId`: केवल owner के outgoing message में target participant का id; participant type server membership से resolve करता है।
- Chat में identity केवल numeric `userId` से manage होती है। Socket connection का auth role केवल authentication/presence के लिए है।
