const express = require("express");
const router = express.Router();

// Import controllers
const { signup } = require("../controller/signup");
const { login } = require("../controller/login");
const { sendOTP } = require("../controller/otp");
const { auth } = require("../middlewares/auth");

// Define routes
router.post("/send-otp", sendOTP);
router.post("/signup", signup);
router.post("/login", login);

// Protected route to get user profile
router.get("/profile", auth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
    message: "User profile fetched successfully",
  });
});

module.exports = router;
