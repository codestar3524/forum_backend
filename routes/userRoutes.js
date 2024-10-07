const express = require("express");
const userController = require("../controllers/userController");
const validateAccessToken = require("../middlewares/validateAccessToken");

const router = express.Router();

router.get("/getUser", userController.getUsers);
router.put(
  "/updateUser/:id",
  validateAccessToken,
  userController.updateUser
);
router.put('/:userId/approve', validateAccessToken, userController.approveUser);
router.put('/:userId/reject', validateAccessToken, userController.rejectUser);
router.delete('/:userId', validateAccessToken, userController.deleteUser);

router.get("/:_id", userController.getUserProfile);
router.get("/:_id/comments", userController.getUserComments);
router.get("/:_id/following", userController.getUserFollowing);
router.get("/:_id/followers", userController.getUserFollowers);
router.put(
  "/:_id/follow",
  validateAccessToken,
  userController.toggleUserFollow
);
router.put("/:_id", validateAccessToken, userController.updateUserProfile);

module.exports = router;
