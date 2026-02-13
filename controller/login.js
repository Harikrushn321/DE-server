// controllers/authController.js
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
require("dotenv").config();


// LOGIN CONTROLLER
exports.login = async (req, res) => {
  try {
    // STEP 1: Get credentials
    const { email, password } = req.body;

    // STEP 2: Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // STEP 3: Find user
    let user = await User.findOne({ email });
    // console.log(user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not registered",
      });
    }

    // STEP 4: Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // STEP 5: Generate JWT token
    const payload = { id: user._id, email: user.email }; 
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // console.log(typeof user);
    user = user.toObject(); 
    //i want to add a new field to the user object called token and assign it the value of the token variable
    user.token = token;
    // console.log(user);
    user.password = undefined;
    // console.log(user);

    // STEP 6: Set cookie and send response
    //cookie is a small text file stored on the user's computer by the web browser
    //cookie needs three parameters: name, data, options
    res.cookie("token", token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        token: token
      },
      message: "Login successful",
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};
