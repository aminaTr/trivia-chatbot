import Question from "../models/Question.js";

// export async function getCategories() {
//   const categories = await Question.distinct("category");
//   return { categories };
// }
export async function getCategories() {
  const categories = await Question.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 11 }, // more than 11 questions
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
      },
    },
  ]);

  return { categories: categories.map((c) => c.category) };
}
