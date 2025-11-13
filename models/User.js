import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },

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
