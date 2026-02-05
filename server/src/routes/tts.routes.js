import { Router } from "express";
import { rimeTTSController } from "../controllers/tts.controller.js";

const router = Router();

router.post("/rime", rimeTTSController);

export default router;
