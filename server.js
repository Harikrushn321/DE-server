const express = require("express");
const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./config/db");
require("dotenv").config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));
app.use('/uploads', express.static('uploads'));

// Routes
app.use("/api/auth", require("./routes/user"));
app.use("/api/pdf", require("./routes/pdf"));

// Root route
app.get("/", (req, res) => {
    res.send("PDF Q&A API is running");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? err.message : null
    });
});

const PORT = process.env.PORT || 3500;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
