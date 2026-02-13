const mongoose = require('mongoose');

const queryHistorySchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pdf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PDF',
        required: true 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('QueryHistory', queryHistorySchema); 