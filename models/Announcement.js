import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorRole: { type: String, enum: ["admin", "society"], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// The GET /api/announcements handler does an `$in` lookup on authorId
// across both User and Society collections; an index on the field keeps
// per-author filtering fast as the table grows.
announcementSchema.index({ authorId: 1 });
// Listing sorts newest-first, so support it without an in-memory sort.
announcementSchema.index({ createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
