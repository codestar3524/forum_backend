const Comment = require("../models/commentModel");
const Topic = require("../models/topicModel");

var repliesToDelete = [];

// Helper function to recursively find nested replies to delete
const nest = (comments, id) => {
  comments
    .filter((comment) => comment?.parentComment?.toString() === id?.toString())
    .forEach((comment) => {
      repliesToDelete.push(comment._id);
      nest(comments, comment._id.toString());
    });
};

module.exports = {
  // Fetch comments of a specific topic
  getTopicComments: async (req, res) => {
    try {
      const { id: parentTopic } = req.params;
      const comments = await Comment.find({ parentTopic })
        .populate({ path: "author", select: { password: 0, __v: 0 } })
        .lean()
        .exec();
        
      return res.json({
        comments,
        message: "Comments Retrieved!",
      });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Server error while fetching comments." });
    }
  },

  // Add a new comment
  addComment: async (req, res) => {
    let { id, comment, parentComment } = req.body;
    if (!id || !comment || comment.trim().length === 0) {
      return res.status(400).json({
        message: "Comment field cannot be empty. Please fill it!",
      });
    }

    parentComment = parentComment || null;
    try {
      let createdComment = await Comment.create({
        owner: req.user._id,
        parentTopic: id,
        parentComment,
        content: comment.trim(),
      });

      // Increment the total number of comments in the topic
      if (createdComment) {
        await Topic.findByIdAndUpdate(id, {
          $inc: { totalComments: 1 },
        });
      }

      createdComment = await createdComment.populate({
        path: "author",
        select: { password: 0, __v: 0 },
      });

      return res.status(201).json({
        comment: createdComment,
        message: "Comment Created Successfully!",
      });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Failed to create comment." });
    }
  },

  // Delete a comment and its replies
  deleteComment: async (req, res) => {
    const { id } = req.params;

    try {
      repliesToDelete = [];
      const rootComment = await Comment.findById(id);

      // Ensure only the comment owner can delete the comment
      if (req.user._id.toString() !== rootComment.owner.toString()) {
        return res.status(403).json({
          message: "You are not allowed to delete this comment",
        });
      }

      const comments = await Comment.find();
      nest(comments, rootComment._id.toString());
      repliesToDelete.push(rootComment._id);

      await Comment.deleteMany({ _id: { $in: repliesToDelete } });
      await Topic.findByIdAndUpdate(rootComment.parentTopic, {
        $inc: { totalComments: -repliesToDelete.length },
      });

      return res.status(200).json({
        deletedComments: repliesToDelete,
        message: "Comment Successfully Deleted!",
      });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Failed to delete comment." });
    }
  },

  // Toggle upvote on a comment
  toggleUpvoteComment: async (req, res) => {
    const { id } = req.params;

    try {
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found!" });
      }

      // Handle upvote and remove from downvotes if present
      if (comment.upvotes.includes(req.user._id)) {
        comment.upvotes.pull(req.user._id); // Remove upvote
        await comment.save();
      } else {
        comment.upvotes.push(req.user._id); // Add upvote
        comment.downvotes.pull(req.user._id); // Remove any downvote
        await comment.save();
      }

      return res.status(200).json({
        commentId: id,
        username: req.user._id,
        message: "Comment was upvoted successfully.",
      });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Failed to toggle upvote." });
    }
  },

  // Toggle downvote on a comment
  toggleDownvoteComment: async (req, res) => {
    const { id } = req.params;

    try {
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found!" });
      }

      // Handle downvote and remove from upvotes if present
      if (comment.downvotes.includes(req.user._id)) {
        comment.downvotes.pull(req.user._id); // Remove downvote
        await comment.save();
      } else {
        comment.downvotes.push(req.user._id); // Add downvote
        comment.upvotes.pull(req.user._id); // Remove any upvote
        await comment.save();
      }

      return res.status(200).json({
        commentId: id,
        username: req.user._id,
        message: "Comment was downvoted successfully.",
      });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Failed to toggle downvote." });
    }
  },

  // Get top helpers (users who have the most comments)
  getTopHelpers: async (req, res) => {
    try {
      const topHelpers = await Comment.aggregate([
        { $group: { _id: "$owner", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "username",
            as: "author",
            pipeline: [{ $project: { password: 0, __v: 0 } }],
          },
        },
        { $unwind: "$author" },
        { $limit: 3 },
      ]);

      return res.status(200).json(topHelpers);
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Failed to retrieve top helpers." });
    }
  },
};
