import express from "express";
import { startSession } from "../controllers/session.controller.js";

const router = express.Router();

router.post("/start", startSession);

export default router;
