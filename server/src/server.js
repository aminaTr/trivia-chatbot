import "dotenv/config";
import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

import triviaSocket from "./sockets/trivia.socket.js"; // using socket for tts
import { registerDeepgramSTT } from "./sockets/deepgram.socket.js";

const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  triviaSocket(socket, io);
  registerDeepgramSTT(socket);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// MongoDB connection + start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => console.error("MongoDB connection failed:", err));
