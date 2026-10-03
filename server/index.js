const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "photobooth-signaling-server" });
});

const roomState = new Map();

const getState = (roomId) => {
  if (!roomState.has(roomId)) {
    roomState.set(roomId, {
      countdownStarted: false,
      finished: new Set(),
    });
  }
  return roomState.get(roomId);
};

const emitBoothState = (roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return;

  const participants = [...room];
  io.to(roomId).emit("booth-state", {
    participants: participants.map((id) => ({
      id,
      name: io.sockets.sockets.get(id)?.data?.name || "Guest",
      ready: Boolean(io.sockets.sockets.get(id)?.data?.ready),
    })),
  });
};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    if (!roomId) return;

    const room = io.sockets.adapter.rooms.get(roomId);
    const users = room ? [...room] : [];

    if (users.length >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name || "Guest";
    socket.data.ready = false;

    const participants = [...users, socket.id];

    socket.emit("room-joined", {
      roomId,
      socketId: socket.id,
      participants,
      isInitiator: users.length === 0,
    });

    if (users.length === 1) {
      io.to(users[0]).emit("peer-joined", {
        socketId: socket.id,
        name: socket.data.name,
      });
    }

    getState(roomId);
    emitBoothState(roomId);

    console.log(`Room ${roomId}: ${participants.length}/2 participants`);
  });

  socket.on("set-ready", (ready) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      console.log("set-ready ignored: socket has no room", socket.id);
      return;
    }

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size !== 2) {
      console.log("set-ready ignored: room is not full", roomId, room?.size || 0);
      socket.emit("ready-error", { message: "Waiting for your partner to join." });
      return;
    }

    socket.data.ready = Boolean(ready);
    console.log("READY", roomId, socket.id, socket.data.ready);
    const state = getState(roomId);

    if (!socket.data.ready) {
      state.countdownStarted = false;
      state.finished.clear();
    }

    emitBoothState(roomId);

    const members = [...room]
      .map((id) => io.sockets.sockets.get(id))
      .filter(Boolean);

    if (
      members.length === 2 &&
      members.every((member) => member.data.ready) &&
      !state.countdownStarted
    ) {
      state.countdownStarted = true;
      state.finished.clear();

      const startAt = Date.now() + 3600;

      console.log("BOTH READY -> CAPTURE START", roomId, startAt);

      io.to(roomId).emit("capture-start", {
        startAt,
        shots: 4,
        interval: 1800,
      });
    }
  });

  socket.on("capture-finished", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const state = getState(roomId);
    state.finished.add(socket.id);

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || state.finished.size < 2) return;

    for (const id of room) {
      const member = io.sockets.sockets.get(id);
      if (member) member.data.ready = false;
    }

    state.countdownStarted = false;
    state.finished.clear();
    emitBoothState(roomId);
  });

  socket.on("offer", ({ target, offer }) => {
    if (target) {
      io.to(target).emit("offer", { sender: socket.id, offer });
    }
  });

  socket.on("answer", ({ target, answer }) => {
    if (target) {
      io.to(target).emit("answer", { sender: socket.id, answer });
    }
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    if (target) {
      io.to(target).emit("ice-candidate", {
        sender: socket.id,
        candidate,
      });
    }
  });

  socket.on("disconnect", () => {
    const { roomId } = socket.data;

    if (roomId) {
      const state = roomState.get(roomId);
      if (state) {
        state.countdownStarted = false;
        state.finished.clear();
      }

      socket.to(roomId).emit("peer-left");
      setTimeout(() => emitBoothState(roomId), 0);

      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room || room.size === 0) {
        roomState.delete(roomId);
      }

      console.log(`User left room ${roomId}: ${socket.id}`);
    }
  });
});

server.listen(8001, () => {
  console.log("Photobooth signaling server running on http://localhost:8001");
});
