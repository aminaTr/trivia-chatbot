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
    skipped: {
      type: Boolean,
      default: false,
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
    skips: {
      type: Number,
      default: 0,
    },
    history: [
      {
        questionId: Schema.Types.ObjectId,
        question: String,
        correctAnswer: String,
        userAnswer: String,
        assistantResponse: String,
        action: {
          type: String,
          enum: ["ANSWER", "HINT", "SKIP", "REPEAT"],
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
