import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  googleId: { type: String, index: true, sparse: true },

  role: {
    type: String,
    enum: ["student", "society", "admin"],
    default: "student",
  },
  societyRequestStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none",
  },
});

const User = mongoose.model("User", userSchema);

export default User;
