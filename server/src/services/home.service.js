// Hint logic
import Question from "../models/Question.js";

export async function getCategories() {
  const categories = await Question.distinct("category");
  return { categories };
}
