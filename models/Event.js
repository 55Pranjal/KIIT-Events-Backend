import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    guest: { type: String, required: true },
    registrationStatus: { type: String, required: true },
    coverImageURL: { type: String, required: true },
    eventCategory: { type: String, required: true },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
