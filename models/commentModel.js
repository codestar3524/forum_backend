const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true, // Ensure that owner is always provided
    },
    content: {
      type: String,
      required: true,
      minlength: 1, // Prevent empty comments
    },
    parentTopic: {
      type: mongoose.Types.ObjectId,
      ref: "Topic",
      required: true, // Ensure the comment is associated with a topic
    },
    parentComment: {
      type: mongoose.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    upvotes: [
      {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
    downvotes: [
      {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
  },
  { timestamps: true }
);

// Virtual field to get author details
CommentSchema.virtual("author", {
  ref: "User",
  localField: "owner",
  foreignField: "_id", // Changed from username to _id for direct reference
  justOne: true,
});

// Set virtuals to be included in responses
CommentSchema.set("toObject", { virtuals: true });
CommentSchema.set("toJSON", { virtuals: true });

// Export the model
module.exports = mongoose.model("Comment", CommentSchema);
