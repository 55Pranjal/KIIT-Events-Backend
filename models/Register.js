import mongoose from "mongoose";

const registerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
  },
  { timestamps: true }
);

registerSchema.index({ userId: 1, eventId: 1 }, { unique: true });

const Register = mongoose.model("Register", registerSchema);

export default Register;
