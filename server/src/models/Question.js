import { Schema, model } from "mongoose";

const hintSchema = new Schema(
  {
    hintText: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false }, // hints are embedded, no separate _id
);

const questionSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    acceptedAnswers: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    category: {
      type: String,
      enum: [
        "Science",
        "History",
        "Geography",
        "Sports",
        "Entertainment",
        "Literature",
        "Technology",
        "General Knowledge",
      ],
      default: "General Knowledge",
    },
    hints: { type: [hintSchema], default: [] },
  },
  { timestamps: true },
);

const Question = model("Question", questionSchema);

export default Question;
