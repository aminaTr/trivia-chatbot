// Trivia Session

import { Schema, model, Types } from "mongoose";

const questionAttemptSchema = new Schema(
  {
    questionId: {
      type: Types.ObjectId,
      ref: "Question",
      required: true,
    },
    userAnswer: {
      type: String,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
    },
    hintsUsed: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
    answeredAt: {
      type: Date,
    },
  },
  { _id: false },
);

const triviaSessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // userId: {
    //   type: Types.ObjectId,
    //   ref: "User",
    //   required: true,
    // },
    score: {
      type: Number,
      default: 0,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    questions: [questionAttemptSchema],
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

triviaSessionSchema.index({ status: 1 });

const TriviaSession = model("TriviaSession", triviaSessionSchema);
export default TriviaSession;
