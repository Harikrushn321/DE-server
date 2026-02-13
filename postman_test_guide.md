# PDF Q&A API Testing Guide with Postman

This guide will help you test the three main PDF operations API endpoints. Make sure both the Server (Node.js) and AI (Python Flask) applications are running before testing.

## Prerequisites
1. Start the Node.js Server: `npm run dev` in the Server directory
2. Start the Python Flask server: `python app.py` in the AI directory 
3. Obtain a valid JWT token by logging in

## Testing Flow

The correct sequence for testing:
1. First log in to get a JWT token
2. Upload a PDF file
3. Query the PDF with questions
4. Clear vector data when done

## 1. Login to Get JWT Token

**Endpoint:** `POST http://localhost:3500/api/auth/login`

**Headers:**
- Content-Type: application/json

**Body Type:** raw (JSON)
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Copy the token value for use in subsequent requests.

## 2. Upload PDF Endpoint

**Endpoint:** `POST http://localhost:3500/api/pdf/upload`

**Headers:**
- Authorization: Bearer <your_jwt_token>

**Body Type:** form-data
- Key: `file` (Type: File)
- Value: Select a PDF file from your computer

**Expected Response:**
```json
{
  "message": "PDF uploaded successfully",
  "data": {
    "success": true,
    "message": "Successfully processed 1 PDF files",
    "data": {
      "filenames": ["example.pdf"]
    }
  }
}
```

## 3. Query PDF Endpoint

**Endpoint:** `POST http://localhost:3500/api/pdf/query`

**Headers:**
- Authorization: Bearer <your_jwt_token>
- Content-Type: application/json

**Body Type:** raw (JSON)
```json
{
  "question": "What is the main topic of this document?"
}
```

**Expected Response:**
```json
{
  "answer": "The main topic of this document is...",
  "conversation_history": [
    {
      "role": "user",
      "content": "What is the main topic of this document?"
    },
    {
      "role": "assistant",
      "content": "The main topic of this document is..."
    }
  ]
}
```

## 4. Clear Vector Data Endpoint

**Endpoint:** `POST http://localhost:3500/api/pdf/clear-vector-data`

**Headers:**
- Authorization: Bearer <your_jwt_token>

**Body:** None required

**Expected Response:**
```json
{
  "message": "Vector data cleared successfully",
  "data": {
    "success": true,
    "message": "All data has been cleared",
    "data": null
  }
}
```

## Troubleshooting

1. **401 Unauthorized Error**: Your JWT token might be invalid or expired. Try logging in again.

2. **No PDF File Uploaded Error**: Make sure you're using the form-data body type in Postman and the key is set to `file`.

3. **Please Upload PDF Files First Error**: You need to upload a PDF file before you can query it. Follow the steps in order.

4. **AI Server Connection Error**: Make sure the AI server is running at the URL specified in your Server's .env file (default: http://localhost:5000).

5. **Session Related Issues**: If you're getting inconsistent behavior, try clearing the AI server's session data with the clear-vector-data endpoint and uploading the PDF again. 