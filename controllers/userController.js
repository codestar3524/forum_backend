const bcrypt = require("bcrypt");
const { cloudinary } = require("../utils/cloudinary");
const fs = require("fs-extra");
const User = require("../models/userModel");
const Comment = require("../models/commentModel");
// const Topic = require("../models/topicModel");
// const Tag = require("../models/tagModel");
const YanContract = require('../utils/contract');

module.exports = {
  getUsers: async (req, res) => {
    const { search, page = 1, limit = 10 } = req.query; // Get search query, page, and limit from the request
    const searchQuery = search ? { username: new RegExp(search, 'i') } : {}; // Case-insensitive search by username

    try {
      const totalUsers = await User.countDocuments(searchQuery); // Get total count of users for pagination
      const users = await User.find(searchQuery) // Fetch users based on search query
        .skip((page - 1) * limit) // Skip for pagination
        .limit(parseInt(limit)) // Limit the number of users returned
        .select('-password') // Exclude the password field
        .lean()
        .exec();

      return res.status(200).json({
        users, // Return the users
        totalUsers, // Total number of users for pagination
        currentPage: parseInt(page), // Current page
        totalPages: Math.ceil(totalUsers / limit), // Total pages for pagination
      });
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ message: 'An error occurred while fetching users.' });
    }
  },
  updateUser: async (req, res) => {
    const { id } = req.params;
    const user = {
      username: req.body.username,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    }
    try {
      const updatedUser = await User.findByIdAndUpdate(id, user, { new: true });
      return res.status(200).json({
        message: "User updated successfully",
        updatedUser,
      });
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ message: 'An error occurred while updating user.' });
    }
  },
  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const deletedUser = await User.findByIdAndDelete(userId);

      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'User deleted successfully', deletedUser });
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // In your user controller
  // Backend function for approving a user
  approveUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findByIdAndUpdate(userId, { approved: true }, { new: true });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { walletAddress } = user;

      // Await the transfer and handle possible errors
      const transactionReceipt = await YanContract.mintTokens(walletAddress, 10);

      if (!transactionReceipt) {
        return res.status(500).json({ error: 'Token transfer failed' });
      }

      // Return only the user object
      return res.status(200).json({
        message: 'User approved successfully',
        user: {
          _id: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          approved: user.approved
        }
      });

    } catch (error) {
      console.error('Error approving user:', error); // Log the error for debugging
      return res.status(500).json({ error: 'Server error' });
    }
  },

  rejectUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findByIdAndUpdate(userId, { approved: false }, { new: true });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const transactionReceipt = await YanContract.burnAllTokens(user.walletAddress);

      if (!transactionReceipt) {
        return res.status(500).json({ error: 'Token burn failed' });
      }

      return res.status(200).json({
        message: 'User rejected!',
        user: {
          _id: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          approved: user.approved
        }
      });
    } catch (error) {
      console.log(error);
      
      return res.status(500).json({ error: 'Server error' });
    }
  },

  getUserProfile: async (req, res) => {
    const { _id } = req.params;
    try {
      const user = await User.findById(_id);
      return res.status(200).json(user);
    } catch (err) {
      console.log(err.message);
    }
  },
  getUserComments: async (req, res) => {
    const { _id } = req.params;
    try {
      const comments = await Comment.find({ owner: _id })
        .populate({ path: "author", select: { password: 0, __v: 0 } })
        .populate("parentTopic")
        .lean()
        .exec();
      return res.status(200).json(comments);
    } catch (err) {
      console.log(err.message);
    }
  },
  getUserFollowing: async (req, res) => {
    const { _id } = req.params;
    try {
      const user = await User.findById(_id)
        .populate({ path: "user_following", select: { password: 0, __v: 0 } })
        .lean()
        .exec();
      return res.status(200).json(user.user_following);
    } catch (err) {
      console.log(err.message);
    }
  },
  getUserFollowers: async (req, res) => {
    const { _id } = req.params;
    try {
      const user = await User.findById(_id)
        .populate({ path: "user_followers", select: { password: 0, __v: 0 } })
        .lean()
        .exec();
      return res.status(200).json(user.user_followers);
    } catch (err) {
      console.log(err.message);
    }
  },
  toggleUserFollow: async (req, res) => {
    const { username: usernameToToggleFollow } = req.params;
    const { username: usernameLoggedIn } = req.user;
    if (usernameToToggleFollow === usernameLoggedIn) {
      return res.status(422).json({
        message: "You can't follow yourself!",
      });
    }
    try {
      const currentUser = await User.findOne({ username: usernameLoggedIn });
      const userToToggleFollow = await User.findOne({
        username: usernameToToggleFollow,
      });
      if (!currentUser || !userToToggleFollow) {
        return res.status(404).json({
          message: "User not found!",
        });
      }
      if (currentUser.following.includes(usernameToToggleFollow)) {
        currentUser.following.pull(usernameToToggleFollow);
        await currentUser.save();
        userToToggleFollow.followers.pull(usernameLoggedIn);
        await userToToggleFollow.save();
        return res.status(200).json(currentUser);
      } else {
        currentUser.following.push(usernameToToggleFollow);
        await currentUser.save();
        userToToggleFollow.followers.push(usernameLoggedIn);
        await userToToggleFollow.save();
        return res.status(200).json(currentUser);
      }
    } catch (err) {
      console.log(err.message);
    }
  },
  updateUserProfile: async (req, res) => {
    const { _id } = req.params;

    // Ensure that the user is updating their own profile
    if (_id !== req.user._id) {
      return res.status(401).json({ message: "Unauthorized!" });
    }

    try {
      // Find the user by their ID
      const user = await User.findById(_id);
      if (!user) {
        return res.status(404).json({ message: "User not found!" });
      }

      // Handle username uniqueness if provided
      if (req.body.userName && req.body.userName.trim() !== "" && req.body.userName !== user.username) {
        const existingUser = await User.findOne({ username: req.body.userName });
        if (existingUser) {
          return res.status(422).json({ message: "Username already taken!" });
        }
        user.username = req.body.userName.trim();
      }


      // Update password if current and new password are provided
      if (
        req.body.password &&
        req.body.newPassword &&
        req.body.confirmNewPassword &&
        req.body.newPassword.trim() !== "" &&
        req.body.newPassword === req.body.confirmNewPassword
      ) {
        const passwordMatch = await bcrypt.compare(req.body.password, user.password);
        if (!passwordMatch) {
          return res.status(400).json({ message: "Incorrect current password!" });
        }
        user.password = await bcrypt.hash(req.body.newPassword.trim(), 10);
      }

      if (req?.files && Object.keys(req?.files)?.length > 0) {
        if (req?.files?.avatar) {
          if (req?.files?.avatar?.size > 2 * 1024 * 1024) {
            await fs.unlink(req?.files?.avatar?.tempFilePath);
            return res?.status(400).json({
              message:
                "Avatar image size is too big, Avatar images can't be larger than 2MB in file size",
            });
          }
          if (
            req.files.avatar.mimetype !== "image/jpeg" &&
            req.files.avatar.mimetype !== "image/png"
          ) {
            await fs.unlink(req?.files?.avatar?.tempFilePath);
            return res.status(400).json({
              message:
                "Invalid avatar image format, only JPEG, JPG, PNG are accepted",
            });
          }
          const d = new Date();
          let fileName =
            user.username +
            "_" +
            "avatar" +
            "_" +
            d.toISOString().split("T")[0].replace(/-/g, "") +
            "_" +
            d.toTimeString().split(" ")[0].replace(/:/g, "");
          if (user?.avatar?.public_id) {
            await cloudinary.uploader.destroy(user.avatar.public_id);
          }
          const result = await cloudinary.uploader.upload(
            req.files.avatar.tempFilePath,
            {
              resource_type: "auto",
              public_id: fileName,
              folder: "avatars",
              width: 400,
              height: 400,
              crop: "fill",
            }
          );
          if (result) {
            await fs.unlink(req.files.avatar.tempFilePath);
            user.avatar.public_id = result.public_id;
            user.avatar.url = result.secure_url;
          }
        }
        if (req?.files?.cover) {
          if (req?.files?.cover?.size > 1024 * 1024 * 3) {
            await fs.unlink(req?.files?.cover?.tempFilePath);
            return res.status(400).json({
              message:
                "Cover image size is too big, Cover images can't be larger than 3MB in file size!",
            });
          }
          if (
            req.files.cover.mimetype !== "image/jpeg" &&
            req.files.cover.mimetype !== "image/png"
          ) {
            await fs.unlink(req?.files?.cover?.tempFilePath);
            return res.status(400).json({
              message:
                "Invalid cover image format, only JPEG, JPG, PNG are accepted",
            });
          }
          const d = new Date();
          let fileName =
            user.username +
            "_" +
            "cover" +
            "_" +
            d.toISOString().split("T")[0].replace(/-/g, "") +
            "_" +
            d.toTimeString().split(" ")[0].replace(/:/g, "");
          if (user.cover.public_id) {
            await cloudinary.uploader.destroy(user.cover.public_id);
          }
          const result = await cloudinary.uploader.upload(
            req.files.cover.tempFilePath,
            {
              resource_type: "auto",
              public_id: fileName,
              folder: "covers",
              width: 1920,
              height: 620,
              crop: "fill",
            }
          );
          if (result) {
            await fs.unlink(req.files.cover.tempFilePath);
            user.cover.public_id = result.public_id;
            user.cover.url = result.secure_url;
          }
        }
      }

      const savedUser = await user.save();
      delete user;
      return res.status(200).json({
        updatedUser: savedUser,
        message: "User profile has been updated successfully!",
      });
    } catch (err) {
      console.log(err.message);
    }
  },
};
