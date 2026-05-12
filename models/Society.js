import mongoose from "mongoose";

const societySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  president: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  email: { type: String, required: true },
  phone: { type: String },
  requestStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

// Hot path: every society user's /me, every event/announcement create
// resolves "which society does this user run?" via { president: userId }.
// Most queries also restrict to requestStatus = "approved", so a compound
// index covers both filters with one read.
societySchema.index({ president: 1, requestStatus: 1 });
// Admin requests page + the /api/users/ approved-society dropdown filter
// purely on requestStatus.
societySchema.index({ requestStatus: 1 });

export default mongoose.model("Society", societySchema);
