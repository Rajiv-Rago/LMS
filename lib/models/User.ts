// lib/models/User.ts

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: String,
    password: String,
    role: String,
    createdAt: {type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', userSchema);