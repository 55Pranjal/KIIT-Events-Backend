// models/Highlight.js
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: { type: String, default: "" },
  credit: { type: String, default: "" },
  width: Number,
  height: Number,
});

const GuestSchema = new mongoose.Schema({
  name: { type: String },
  title: { type: String }, // e.g., "Chief Guest", "Speaker"
  bio: { type: String },
  photo: ImageSchema, // optional guest photo
});

const HighlightSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    title: { type: String, required: true, maxlength: 150 },
    shortDescription: { type: String, required: true, maxlength: 400 },
    longDescription: { type: String, maxlength: 5000 },
    gallery: [ImageSchema],
    guests: [GuestSchema],
    keyHighlights: [String],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    featured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Highlight", HighlightSchema);
