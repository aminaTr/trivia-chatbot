import express from "express";
import { summarizeResults } from "../controllers/results.controller.js";

const router = express.Router();

router.post("/summary-results", summarizeResults);

export default router;
