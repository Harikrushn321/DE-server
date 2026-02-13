const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Invalid email"],
    unique: true, // Ensure unique email for OTP
  },
  otp: {
    type: String,
    required: [true, "OTP is required"],
    minlength: [6, "OTP must be 6 characters long"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // Auto-delete after 5 minutes
  },
});

// Send OTP email on creation
otpSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      // Check if email configuration exists
      if (!process.env.NODEMAILER_USER || !process.env.NODEMAILER_PASS) {
        console.error("OTP Email Error: Email configuration missing");
        // Don't block OTP creation if email fails, but log the error
        return next();
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.NODEMAILER_USER,
          pass: process.env.NODEMAILER_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        dns: {
          servers: ['8.8.8.8', '8.8.4.4'],
          timeout: 5000,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.sendMail({
        from: `"AskMyFile" <${process.env.NODEMAILER_USER}>`,
        to: this.email,
        subject: "Your OTP Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Your OTP Code</h2>
            <p>Your One-Time Password (OTP) for AskMyFile is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${this.otp}</h1>
            </div>
            <p>This OTP is valid for <strong>5 minutes</strong>.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
          </div>
        `,
        text: `Your OTP is ${this.otp} (valid for 5 minutes)`,
      });

      console.log(`OTP email sent successfully to ${this.email}`);
    } catch (error) {
      // Log error but don't block OTP creation
      console.error("OTP Email Error:", {
        message: error.message,
        code: error.code,
        email: this.email,
      });
      
      // In production, you might want to handle this differently
      // For now, we'll allow OTP creation even if email fails
      // This ensures the OTP is still saved and can be retrieved via API if needed
    }
  }
  next();
});

module.exports = mongoose.model('OTP', otpSchema);