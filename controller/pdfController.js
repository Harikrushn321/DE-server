    const axios = require('axios');
    const path = require('path');
    const fs = require('fs');
    const FormData = require('form-data');
    const PDF = require('../models/PDF');
    const QueryHistory = require('../models/QueryHistory');


    // Configure axios with AI server base URL
    // IMPORTANT: Use 127.0.0.1 instead of localhost on macOS to avoid AirPlay Receiver conflict on port 5000
    let AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://127.0.0.1:5000';
    
    // Convert localhost to 127.0.0.1 to avoid macOS AirPlay Receiver issues
    if (AI_SERVER_URL.includes('localhost:5000')) {
        console.warn('⚠️  WARNING: localhost:5000 detected. Converting to 127.0.0.1:5000 to avoid macOS AirPlay Receiver conflict.');
        AI_SERVER_URL = AI_SERVER_URL.replace('localhost', '127.0.0.1');
    }
    
    console.log('Using AI server URL:', AI_SERVER_URL);

    // Store cookies per user (userId -> cookies)
    const userCookies = new Map();

    /**
     * Get or create axios instance for a specific user
     * This ensures each user has their own session with the AI server
     */
    const getAiAxiosForUser = (userId) => {
        // Create a dedicated axios instance for this user
        const aiAxios = axios.create({
            baseURL: AI_SERVER_URL,
            withCredentials: true,
            timeout: 60000, // 60 seconds timeout for large file uploads
            headers: {
                'Accept': 'application/json',
            }
        });

        // Response interceptor to store cookies per user
        aiAxios.interceptors.response.use(
            response => {
                // Store cookies from response for this user
                const setCookieHeader = response.headers['set-cookie'];
                if (setCookieHeader) {
                    // Handle both array and string formats
                    const cookieString = Array.isArray(setCookieHeader) 
                        ? setCookieHeader.join('; ') 
                        : setCookieHeader;
                    userCookies.set(userId, cookieString);
                }
                return response;
            },
            error => {
                // Enhanced error logging
                if (error.response) {
                    console.error(`AI Server Error for user ${userId}:`, {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data,
                        headers: error.response.headers
                    });
                } else if (error.request) {
                    console.error(`AI Server Connection Error for user ${userId}:`, {
                        message: error.message,
                        code: error.code
                    });
                }
                return Promise.reject(error);
            }
        );

        // Request interceptor to add cookies for this user
        aiAxios.interceptors.request.use(config => {
            // Add cookies to request if we have them for this user
            const cookies = userCookies.get(userId);
            if (cookies) {
                config.headers.Cookie = cookies;
            }
            return config;
        });

        return aiAxios;
    };

    const pdfController = {
        // Upload PDF and send to AI server
        uploadPDF: async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: 'No PDF file uploaded' });
                }

                const userId = req.user._id.toString();
                const aiAxios = getAiAxiosForUser(userId);

                // Create form data with the actual file
                const formData = new FormData();
                formData.append('pdf_files', fs.createReadStream(req.file.path), {
                    filename: req.file.originalname,
                    contentType: 'application/pdf'
                });

                console.log(`Sending PDF to AI server for user ${userId}:`, req.file.originalname);

                // Send to AI server with proper headers
                // FormData.getHeaders() already includes Content-Type with boundary
                const response = await aiAxios.post('/upload', formData, {
                    headers: {
                        ...formData.getHeaders()
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    timeout: 120000 // 2 minutes for large files
                });

                console.log('AI server response:', response.data);

                // Check if AI server returned success
                if (!response.data || !response.data.success) {
                    throw new Error(response.data?.message || 'AI server returned unsuccessful response');
                }

                // Save PDF metadata to database
                const pdf = new PDF({
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    path: req.file.path,
                    user: req.user._id
                });
                const savedPdf = await pdf.save();

                res.json({
                    message: 'PDF uploaded successfully',
                    data: {
                        _id: savedPdf._id, // Include the MongoDB document ID
                        filename: savedPdf.filename,
                        originalname: savedPdf.originalname
                    },
                    aiResponse: response.data
                });
            } catch (error) {
                console.error('Upload error:', error.message);
                
                // Enhanced error handling
                if (error.response) {
                    const status = error.response.status;
                    const errorData = error.response.data;
                    
                    console.error('AI Server Error Details:', {
                        status: status,
                        statusText: error.response.statusText,
                        data: errorData,
                        url: `${AI_SERVER_URL}/upload`
                    });

                    // Handle specific error codes
                    if (status === 403) {
                        // Detect macOS AirPlay Receiver conflict
                        const serverHeader = error.response.headers['server'] || error.response.headers['Server'] || '';
                        const isAirPlay = serverHeader.includes('AirTunes') || serverHeader.includes('AirPlay');
                        
                        if (isAirPlay) {
                            console.error('🚨 macOS AirPlay Receiver detected on port 5000!');
                            console.error('   This happens when using localhost:5000 on macOS.');
                            console.error('   Solution: Use 127.0.0.1:5000 instead, or disable AirPlay Receiver in System Settings.');
                            
                            return res.status(503).json({
                                error: 'Port 5000 conflict detected: macOS AirPlay Receiver is intercepting requests.',
                                details: 'On macOS, localhost:5000 is used by AirPlay Receiver. Please use 127.0.0.1:5000 instead, or disable AirPlay Receiver in System Settings > General > AirDrop & Handoff.',
                                solution: 'Set AI_SERVER_URL=http://127.0.0.1:5000 in your .env file or environment variables.'
                            });
                        }
                        
                        return res.status(503).json({
                            error: 'AI server access denied. Please ensure the AI server is running and properly configured.',
                            details: errorData?.message || 'Forbidden - Check AI server configuration'
                        });
                    } else if (status === 400) {
                        return res.status(400).json({
                            error: errorData?.message || errorData || 'Invalid request to AI server'
                        });
                    } else if (status === 500) {
                        return res.status(502).json({
                            error: 'AI server internal error. Please try again later.',
                            details: errorData?.message || 'Internal server error on AI server'
                        });
                    } else {
                        const fallbackMessage = typeof errorData === 'string'
                            ? errorData
                            : (errorData?.message || errorData?.error || 'Error from AI server');
                        return res.status(status >= 500 ? 502 : status).json({
                            error: fallbackMessage
                        });
                    }
                } else if (error.request) {
                    // Request was made but no response received
                    console.error('AI Server Connection Error:', {
                        message: error.message,
                        code: error.code,
                        url: AI_SERVER_URL
                    });
                    return res.status(503).json({
                        error: 'Unable to connect to AI server. Please ensure the AI server is running on ' + AI_SERVER_URL,
                        details: error.code === 'ECONNREFUSED' 
                            ? 'Connection refused - AI server may not be running'
                            : error.message
                    });
                } else {
                    // Error setting up the request
                    console.error('Upload Setup Error:', error.message);
                    return res.status(500).json({
                        error: 'Error uploading PDF: ' + error.message
                    });
                }
            }
        },
    
        // Query PDF and store history
        queryPDF: async (req, res) => {
            try {
                const { question, pdfId } = req.body;
                if (!question) {
                    return res.status(400).json({ error: 'Question is required' });
                }
                if (!pdfId) {
                    return res.status(400).json({ error: 'PDF ID is required' });
                }

                // Verify PDF exists and belongs to user
                const pdf = await PDF.findOne({ _id: pdfId, user: req.user._id });
                if (!pdf) {
                    return res.status(404).json({ error: 'PDF not found or not authorized' });
                }

                const userId = req.user._id.toString();
                const aiAxios = getAiAxiosForUser(userId);

                console.log(`Sending query to AI server for user ${userId}:`, question);

                // Send query to AI server using URLSearchParams for form data
                const params = new URLSearchParams();
                params.append('query', question);

                const response = await aiAxios.post('/query', params, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                console.log('AI server query response:', response.data);

                // Check if we have a valid response
                if (!response.data || !response.data.success || !response.data.data) {
                    return res.status(500).json({ 
                        error: response.data?.message || 'Invalid response from AI server' 
                    });
                }

                // Store query history
                const queryHistory = new QueryHistory({
                    question,
                    answer: response.data.data.answer,
                    user: req.user._id,
                    pdf: pdfId  // Add PDF reference
                });
                await queryHistory.save();

                res.json({
                    answer: response.data.data.answer,
                    conversation_history: response.data.data.conversation_history
                });
            } catch (error) {
                console.error('Query error:', error.message);
                if (error.response) {
                    console.error('Response error data:', error.response.data);
                    return res.status(error.response.status || 500).json({
                        error: error.response.data?.message || error.response.data?.error || 'Error from AI server'
                    });
                } else if (error.request) {
                    return res.status(503).json({
                        error: 'Unable to connect to AI server. Please ensure the AI server is running.'
                    });
                }
                res.status(500).json({ error: 'Error processing query: ' + error.message });
            }
        },

        // Clear vector data
        clearVectorData: async (req, res) => {
            try {
                const userId = req.user._id.toString();
                const aiAxios = getAiAxiosForUser(userId);
                
                console.log(`Sending clear vector data request to AI server for user ${userId}`);

                // Send request to AI server
                const response = await aiAxios.post('/clear-vector-data');

                console.log('AI server clear vector data response:', response.data);

                res.json({
                    message: 'Vector data cleared successfully',
                    data: response.data
                });
            } catch (error) {
                console.error('Clear vector data error:', error.message);
                if (error.response) {
                    console.error('Response error data:', error.response.data);
                    return res.status(error.response.status || 500).json({
                        error: error.response.data?.message || error.response.data?.error || 'Error from AI server'
                    });
                } else if (error.request) {
                    return res.status(503).json({
                        error: 'Unable to connect to AI server. Please ensure the AI server is running.'
                    });
                }
                res.status(500).json({ error: 'Error clearing vector data: ' + error.message });
            }
        },

        // Get all PDFs for the logged-in user
        getAllPDFs: async (req, res) => {
            try {
                // Find all PDFs for the current user
                const pdfs = await PDF.find({ user: req.user._id })
                    .select('-path') // Exclude the server path for security
                    .sort({ createdAt: -1 }); // Sort by newest first

                // Add fileUrl to each PDF
                const pdfsWithUrls = pdfs.map((pdf) => ({
                    ...pdf._doc,
                    fileUrl: `${req.protocol}://${req.get('host')}/uploads/${pdf.filename}`,
                }));

                res.json({
                    count: pdfsWithUrls.length,
                    pdfs: pdfsWithUrls,
                });
            } catch (error) {
                console.error('Error fetching PDFs:', error.message);
                res.status(500).json({ error: 'Error fetching PDF list: ' + error.message });
            }
        },

        // Get a single PDF by ID
        getPDFById: async (req, res) => {
            try {
                const { id } = req.params;
                
                // Find PDF by ID and verify it belongs to the user
                const pdf = await PDF.findOne({ _id: id, user: req.user._id })
                    .select('-path'); // Exclude the server path for security
                
                if (!pdf) {
                    return res.status(404).json({ error: 'PDF not found or not authorized' });
                }

                // Add fileUrl
                const pdfWithUrl = {
                    ...pdf._doc,
                    fileUrl: `${req.protocol}://${req.get('host')}/uploads/${pdf.filename}`,
                };

                res.json({
                    pdf: pdfWithUrl
                });
            } catch (error) {
                console.error('Error fetching PDF:', error.message);
                res.status(500).json({ error: 'Error fetching PDF: ' + error.message });
            }
        },

        deletePDF: async (req, res) => {
            try {
            const { id } = req.params;
            
            // Check if PDF exists and belongs to user
            const pdf = await PDF.findOne({ _id: id, user: req.user._id });
            
            if (!pdf) {
                return res.status(404).json({ error: 'PDF not found or not authorized' });
            }
            
            
            // Delete file from filesystem
            fs.unlink(pdf.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });

            // Delete all associated query history entries
        await QueryHistory.deleteMany({ pdf: id });
            // Delete from database
        await PDF.deleteOne({ _id: id });
        
        res.json({ message: 'PDF deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error.message);
        res.status(500).json({ error: 'Error deleting PDF: ' + error.message });
    }
    },

    // Get query history for the logged-in user
    getQueryHistory: async (req, res) => {
        try {

            const { limit = 50, search } = req.query;
            const filter = { user: req.user._id };
            
            if (search) {
                filter.$or = [
                    { question: { $regex: search, $options: 'i' } },
                    { answer: { $regex: search, $options: 'i' } }
                ];
            }
        // Find all query history entries for the current user
        const history = await QueryHistory.find(filter)
                .populate('pdf', 'originalname filename') // Include PDF info
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));
        res.json({
            count: history.length,
            history: history
        });
        } catch (error) {
        console.error('Error fetching query history:', error.message);
        res.status(500).json({ error: 'Error fetching query history: ' + error.message });
        }
    }


    };

    module.exports = pdfController; 