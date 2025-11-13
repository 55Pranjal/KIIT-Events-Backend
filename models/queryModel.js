import mongoose from "mongoose";

const querySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: String,
    email: String,
    message: {
      type: String,
      required: true,
    },
    reply: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Query", querySchema);
