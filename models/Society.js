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

export default mongoose.model("Society", societySchema);
