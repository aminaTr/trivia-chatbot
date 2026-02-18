import express from "express";
import cors from "cors";
import sessionRoutes from "./routes/session.routes.js";
import ttsRoutes from "./routes/tts.routes.js";
import homeRoutes from "./routes/home.routes.js";
import summaryRoutes from "./routes/summary.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.use("/api/sessions", sessionRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/summary", summaryRoutes);

console.log("CORS allowed origin:", process.env.CLIENT_URL);

export default app;
