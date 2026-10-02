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

    console.log(
      `Room ${roomId}: ${participants.length}/2 participants`
    );
  });

  socket.on("offer", ({ target, offer }) => {
    if (target) {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    }
  });

  socket.on("answer", ({ target, answer }) => {
    if (target) {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
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
      socket.to(roomId).emit("peer-left");
      console.log(`User left room ${roomId}: ${socket.id}`);
    }
  });
});

server.listen(8001, () => {
  console.log("Photobooth signaling server running on http://localhost:8001");
});
