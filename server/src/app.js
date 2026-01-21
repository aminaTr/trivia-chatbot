import express from "express";
import sessionRoutes from "./routes/session.routes.js";

const app = express();
app.use(express.json());

app.use("/api/sessions", sessionRoutes);

export default app;
