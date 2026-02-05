import { getCategories } from "../services/home.service.js";

export async function categoriesController(req, res) {
  try {
    const response = await getCategories();
    return res.json(response, 200);
  } catch (err) {
    console.error("Home service error:", err);
    res.status(500).json({ error: "Failed to retrieve home data" });
  }
}
