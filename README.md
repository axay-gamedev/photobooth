# 📸 Real-Time Photobooth

A two-person virtual photobooth where friends can join the same room, see each other live, and capture synchronized memories together.

## ✨ Features

- 👥 Private two-person rooms
- 📹 Real-time video using WebRTC
- 🔌 Socket.IO signaling and room synchronization
- ⏱️ Synchronized 3-2-1 countdown
- 📸 Four-shot photobooth sessions
- 💥 Camera flash + shutter sound
- 🎞️ Strip, Polaroid, and single-photo formats
- 🎨 Original, B&W, Vintage, Warm, and Film filters
- ❤️ Captions and stickers
- 🔐 Optional secret message added when saving
- 🖼️ Local memories gallery
- 🔄 Mirror camera toggle
- 🎤 Microphone, camera, speaker, and sound controls
- 📱 Responsive/mobile-friendly UI
- ☁️ Deployed frontend + real-time backend

## 🛠️ Tech Stack

**Frontend**
- React
- CSS
- Lucide React
- Socket.IO Client
- WebRTC
- Canvas API

**Backend**
- Node.js
- Express
- Socket.IO

**Deployment**
- Vercel — React frontend
- Render — Node.js + Socket.IO server

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/axay-gamedev/photobooth.git
cd photobooth
```

### 2. Start the server

```bash
cd server
npm install
node index.js
```

The signaling server runs on:

```
http://localhost:8001
```

### 3. Start the client

Open another terminal:

```bash
cd client
npm install
npm start
```

The React app runs on:

```
http://localhost:3000
```

By default, the client connects to `http://localhost:8001`.

To use a different backend:

```env
REACT_APP_SOCKET_URL=https://your-server-url
```

## 🌐 Live Backend

The deployed Socket.IO backend is available at:

https://photobooth-zenm.onrender.com/

## 🧠 How It Works

1. One person creates a room.
2. The second person joins using the room code/link.
3. WebRTC establishes a peer-to-peer video connection.
4. Socket.IO keeps room state and readiness synchronized.
5. Both users press the shutter when they're ready.
6. The server broadcasts a synchronized capture start.
7. Both clients capture four frames locally from the live video streams.
8. Canvas generates the final photobooth memory.
9. The finished memory can be edited, saved, and stored locally in the browser.

## 📁 Project Structure

```
photobooth/
├── client/        # React frontend
│   └── src/
└── server/        # Express + Socket.IO signaling server
```

## 🔒 Privacy

Photos are generated and stored locally in the browser's `localStorage`. The project does not upload finished photos to a database or photo storage service.

Camera and microphone access is requested by the browser and requires user permission.

## ❤️ Built For

A small project exploring real-time communication, WebRTC, synchronized interactions, and making something genuinely fun with code.

---

Built with React, WebRTC, Socket.IO, and way too much debugging. 🍪📸
