//  Fetch questions

import Question from "../models/Question.js";

export async function getQuestion({ questionId }) {
  const question = await Question.findOne({ questionId });

  return question;
}
