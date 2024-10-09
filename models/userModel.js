const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: {
    type: String,
    unique: true,
  },
  username: {
    type: String,
    unique: true,
  },
  password: String,
  avatar: {
    public_id: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      default: "https://i.imgur.com/iV7Sdgm.jpg",
    },
  },
  cover: {
    public_id: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      default: "wallpaper.jpg",
    },
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500,
    default: "A new user of ONetwork forum",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  following: [
    {
      type: String,
      default: [],
    },
  ],
  followers: [
    {
      type: String,
      default: [],
    },
  ],
  // New fields for approval and rejection status
  approved: {
    type: Boolean,
    default: false,
  }
});

// Virtuals for user following and followers
UserSchema.virtual("user_following", {
  ref: "User",
  localField: "following",
  foreignField: "username",
});

UserSchema.virtual("user_followers", {
  ref: "User",
  localField: "followers",
  foreignField: "username",
});

// Enable virtuals for JSON and object output
UserSchema.set("toObject", { virtuals: true });
UserSchema.set("toJSON", { virtuals: true });

// Auto increment the userID field
UserSchema.plugin(AutoIncrement, { inc_field: "userID" });

module.exports = mongoose.model("User", UserSchema);
