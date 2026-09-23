import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Team } from './models/Team.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { registrationId, teamName, members, timestamp } = req.body;

    // Check if team name already exists
    const existingTeam = await Team.findOne({ teamName });
    if (existingTeam) {
      return res.status(400).json({ error: 'Team name is already taken' });
    }

    // Check for duplicate members (email or phone)
    for (const member of members) {
      const existingMember = await Team.findOne({
        $or: [
          { 'members.email': member.email },
          { 'members.phone': member.phone }
        ]
      });
      if (existingMember) {
        return res.status(400).json({ error: `${member.name} (${member.email} or ${member.phone}) is already registered in another team.` });
      }
    }

    // Save new team
    const newTeam = new Team({
      registrationId,
      teamName,
      members,
      createdAt: timestamp ? new Date(timestamp) : new Date()
    });

    await newTeam.save();

    res.status(201).json({ status: 'success', registrationId });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Failed to register team' });
  }
});

// Status Endpoint
app.get('/api/status', async (req, res) => {
  try {
    const count = await Team.countDocuments();
    res.json({ teamCount: count });
  } catch (error) {
    console.error('Status Error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
