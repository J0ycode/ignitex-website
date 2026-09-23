import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  college: { type: String, required: true },
  isLeader: { type: Boolean, default: false }
});

const teamSchema = new mongoose.Schema({
  registrationId: { type: String, required: true, unique: true },
  teamName: { type: String, required: true, unique: true },
  members: [memberSchema],
  createdAt: { type: Date, default: Date.now }
});

export const Team = mongoose.model('Team', teamSchema);
