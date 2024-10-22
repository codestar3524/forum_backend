const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middlewares/generateTokens");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/nodemailer");
const verifyEmailTemplate = require("../utils/Emails_Templates/verifyEmailTemplate");
const forgotPasswordTemplate = require("../utils/Emails_Templates/forgotPasswordTemplate");
const generateEmailVerifyToken = require("../middlewares/generateEmailVerifyToken");
const generatePasswordResetToken = require("../middlewares/generatePasswordResetToken");

module.exports = {
  register: async (req, res) => {
    const { username, firstName, lastName, walletAddress } = req.body;
  console.log(req.body);
  
    // Check if all required fields are provided
    if (!username || !firstName || !lastName || !walletAddress) {
      return res.status(422).json({
        message: "Required field(s) are missing!",
      });
    }
  
    try {
      // Check the current user count in the database
      const userCount = await User.countDocuments();
  
      // Check if the wallet address already exists
      const existingUser = await User.findOne({ walletAddress });
      if (existingUser) {
        return res.status(400).json({
          message: "An account already exists with this wallet address!",
        });
      }
  
      // Set role and approval status based on the user count (first user is admin)
      const isAdmin = userCount === 0;
      const role = isAdmin ? 'admin' : 'user';
      const approved = isAdmin ? true : false;
  
      // Create a new user
      const newUser = await User.create({
        firstName,
        lastName,
        username,
        walletAddress,
        role,
        approved,
      });
  
      // Respond with success message
      return res.status(201).json({
        message: isAdmin
          ? "Your account has been created successfully as an admin and approved."
          : "Your account has been created successfully. You can use it after administrator approval.",
      });
  
    } catch (error) {
      return res.status(500).json({
        message: `Error creating user: ${error.message}`,
      });
    }
  },   
  login: async (req, res) => {
    const { username, walletAddress } = req.body;
    
    if (!username || !walletAddress) {
      return res.status(400).json({
        message: "username and walletAddress is missing!",
      });
    }
    try {
      const userExisted = await User.findOne({ walletAddress });
      if (!userExisted) {
        return res.status(400).json({
          message: "No such user with this address!",
        });
      }
      
      if (userExisted.username != username) {
        return res.status(400).json({
          message: "NickName isn't match with your wallet",
        });
      }
      
      if (!userExisted.approved) {
        return res.status(400).json({
          message: "Your account deactivate. Please reach out to administrator.",
        });
      }
      const accessToken = generateAccessToken(userExisted);
      const refreshToken = generateRefreshToken(
        userExisted,
        process.env.REFRESH_TOKEN_EXPIRATION
      );

      res.cookie("refreshToken", refreshToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        sameSite: "Strict",
        path: "/refresh_token",
      });

      delete userExisted.__v;

      return res.status(200).json({
        message: "User logged-in successfully!",
        token: accessToken,
        user: userExisted,
        isLoggedIn: true,
      });
    } catch (err) {
      return res.json({
        message: err.message,
      });
    }
  },
  refresh_token: async (req, res) => {
    let { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(403).json({
        message: "Unauthorized, You must login!",
      });
    }
  
    try {
      const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET_KEY);
      const user = await User.findOne({ walletAddress: payload.walletAddress }, { __v: 0 });
  
      if (!user) {
        return res.status(403).json({
          message: "Unauthorized, You must login!",
        });
      }
  
      const expiration = payload.exp - Math.floor(Date.now() / 1000);
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user, expiration);
  
      // Set the new refresh token in the cookie
      res.cookie("refreshToken", newRefreshToken, {
        maxAge: expiration * 1000, // Ensure correct expiration time
        httpOnly: true,
        sameSite: "Strict",
        path: "/refresh_token",
      });
  
      return res.json({
        user: user,
        token: newAccessToken, // Send the new access token to the client
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        message: "Token refresh failed",
      });
    }
  },
  logout: async (req, res) => {
    try {
      const { username } = req.user;
      if (!username) {
        return res.status(400).json({
          message: "You're not logged-in!",
        });
      }
      res.cookie("refreshToken", "Onetwork Forum", {
        maxAge: -1,
        httpOnly: true,
        sameSite: "Strict",
        path: "/refresh_token",
      });
      return res.json({
        message: "User successfully logged out!",
      });
    } catch (err) {
      return res.json(err.message);
    }
  },
  emailVerify: async (req, res) => {
    try {
      const { email } = req.user;
      if (!email) {
        return res.status(404).json({
          message: "No Email Verification Token!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          message: "Your e-mail is already verified!",
        });
      }
      if (!user.isVerified) {
        await User.findOneAndUpdate(
          { email },
          {
            isVerified: true,
          }
        );
        return res.status(200).json({
          message: "Your e-mail has been successfully verified!",
        });
      }
    } catch (err) {
      console.log(err.message);
    }
  },
  sendEmailVerification: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          message: "No email was provided, Please enter an email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          message: "Your e-mail is already verified!",
        });
      }
      if (!user.isVerified) {
        const token = generateEmailVerifyToken(email);
        let options = {
          email: email,
          subject: "Verify your email address",
          html: verifyEmailTemplate(user, token),
        };

        await sendEmail(options);
        return res.status(200).json({
          message: `An account activation link has been sent to ${email}`,
        });
      }
    } catch (err) {
      console.log(err.message);
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { email } = req.user;
      const { newPassword, confirmNewPassword } = req.body;
      if (!email) {
        return res.status(404).json({
          message: "No Password Reset Token!",
        });
      }
      if (!newPassword?.trim() || !confirmNewPassword?.trim()) {
        return res.status(404).json({
          message: "You have to enter both the two passwords!",
        });
      }
      if (newPassword?.trim() !== confirmNewPassword?.trim()) {
        return res.status(404).json({
          message:
            "The two passwords that you enter have to be the same, Try again!",
        });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword?.trim(), 10);
      user.password = hashedPassword;
      await user.save();
      return res.status(200).json({
        message: "Your password has been reset successfully",
      });
    } catch (err) {
      console.log(err.message);
    }
  },
  sendForgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          message: "No email was provided, Please enter an email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "No such user with this email!",
        });
      }
      const token = generatePasswordResetToken(email);
      let options = {
        email: email,
        subject: "Reset your password",
        html: forgotPasswordTemplate(user, token),
      };

      await sendEmail(options);
      return res.status(200).json({
        message: `Reset password email has been sent to ${email}`,
      });
    } catch (err) {
      console.log(err.message);
    }
  },
};
