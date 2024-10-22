const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    unique: true,
    required: true,
  },
  avatar: {
    public_id: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      default: "https://res.cloudinary.com/forumcloud/image/upload/v1729441784/3d-rendering-boy-business-suit-with-smile_1142-41042_hbvwm4.jpg",
    },
  },
  cover: {
    public_id: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      default: "https://res.cloudinary.com/forumcloud/image/upload/v1729442232/wallpaper_zbain0.jpg",
    },
  },
  walletAddress: {
    type: String,
    unique: true,
    maxlength: 500,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  approved: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ["admin", "user"],
    default: "user",
  },
  tokenBalance: {
    type: Number,
    default: 0,
  },
  totalStaked: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

UserSchema.plugin(AutoIncrement, { inc_field: "userID" });
UserSchema.set("toObject", { virtuals: true });
UserSchema.set("toJSON", { virtuals: true });

const User = mongoose.model("User", UserSchema);

module.exports = User;