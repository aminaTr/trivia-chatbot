import express from "express";
import { categoriesController } from "../controllers/home.controller.js";

const router = express.Router();

router.get("/categories", categoriesController);
export default router;
