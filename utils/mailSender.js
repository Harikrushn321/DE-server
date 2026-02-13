const nodemailer = require("nodemailer");
require("dotenv").config();

/**
 * Creates a nodemailer transporter with explicit SMTP configuration
 * @returns {Object} - Configured transporter
 */
const createTransporter = () => {
  // Check if required environment variables are set
  if (!process.env.NODEMAILER_USER || !process.env.NODEMAILER_PASS) {
    throw new Error("Email configuration missing: NODEMAILER_USER and NODEMAILER_PASS must be set");
  }

  // Use explicit SMTP configuration for better reliability
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.NODEMAILER_USER,
      pass: process.env.NODEMAILER_PASS,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Retry configuration
    pool: false,
    maxConnections: 1,
    maxMessages: 3,
    // DNS lookup options
    dns: {
      servers: ['8.8.8.8', '8.8.4.4'], // Google DNS as fallback
      timeout: 5000,
    },
    // TLS options
    tls: {
      rejectUnauthorized: false, // For development, set to true in production with proper certs
    },
  });
};

/**
 * Sends an email using Nodemailer
 * @param {string} email - Recipient's email
 * @param {string} subject - Email subject
 * @param {string} body - Email HTML content
 * @returns {Promise<Object>} - Info about the sent email
 */
const mailSender = async (email, subject, body) => {
  let transporter;
  try {
    // Validate email format
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new Error("Invalid email address");
    }

    // Create a transporter
    transporter = createTransporter();

    // Verify connection before sending
    await transporter.verify();

    // Send the email
    const info = await transporter.sendMail({
      from: `"PDF Q&A" <${process.env.NODEMAILER_USER}>`,
      to: email,
      subject: subject,
      html: body,
    });

    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    // Enhanced error logging
    if (error.code === 'ENOTFOUND' || error.code === 'EDNS') {
      console.error("DNS Error: Cannot resolve smtp.gmail.com. Check your internet connection and DNS settings.");
      throw new Error("Network error: Unable to connect to email server. Please check your internet connection.");
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error("Connection Error: Unable to connect to SMTP server.");
      throw new Error("Connection error: Unable to reach email server. Please try again later.");
    } else if (error.responseCode === 535) {
      console.error("Authentication Error: Invalid email credentials.");
      throw new Error("Email authentication failed. Please check email configuration.");
    } else {
      console.error("Error sending email:", {
        message: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
      throw new Error(`Failed to send email: ${error.message}`);
    }
  } finally {
    // Close transporter connection if it exists
    if (transporter && transporter.close) {
      transporter.close();
    }
  }
};

module.exports = mailSender;
