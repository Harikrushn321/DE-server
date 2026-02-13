const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

// Auth middleware to protect routes
exports.auth = async (req, res, next) => {
  try {
    // Get token from header or cookies
    const token = req.cookies.token || 
                  req.body.token || 
                  req.header("Authorization")?.replace("Bearer ", "");

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login.",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user by ID
      const user = await User.findById(decoded.id).select("-password");
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid token. User not found.",
        });
      }
      
      // Set user in request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or token expired",
      });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}; 