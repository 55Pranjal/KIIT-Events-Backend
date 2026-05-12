import { z } from "zod";

// Reusable: trimmed non-empty string with a friendly message.
const nonEmptyString = (label) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`);

// 24-char hex Mongo ObjectId. Used where the body carries a foreign key.
const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid id format");

// "YYYY-MM-DD" — what the <input type="date"> control submits.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// "HH:MM" or "HH:MM:SS".
const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM");

const registrationStatusEnum = z.enum(["open", "closed", "upcoming"], {
  errorMap: () => ({
    message: "registrationStatus must be open, closed, or upcoming",
  }),
});

// ===== Events =====
export const createEventSchema = z.object({
  title: nonEmptyString("title").max(200),
  date: dateString,
  time: timeString,
  location: nonEmptyString("location").max(300),
  description: nonEmptyString("description").max(5000),
  guest: z.string().trim().max(200).optional().default(""),
  registrationStatus: registrationStatusEnum,
  coverImageURL: nonEmptyString("coverImageURL").max(2000),
  eventCategory: nonEmptyString("eventCategory").max(100),
  // Society users have this resolved server-side; admins must supply it.
  // Accepted/required logic lives in the route, not the schema.
  societyId: objectIdString.optional(),
});

export const updateEventSchema = z
  .object({
    title: nonEmptyString("title").max(200).optional(),
    date: dateString.optional(),
    time: timeString.optional(),
    location: nonEmptyString("location").max(300).optional(),
    description: nonEmptyString("description").max(5000).optional(),
    guest: z.string().trim().max(200).optional(),
    registrationStatus: registrationStatusEnum.optional(),
    coverImageURL: nonEmptyString("coverImageURL").max(2000).optional(),
    eventCategory: nonEmptyString("eventCategory").max(100).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// ===== Societies =====
export const createSocietyRequestSchema = z.object({
  name: nonEmptyString("name").max(150),
  description: z.string().trim().max(2000).optional().default(""),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  phone: z.string().trim().max(30).optional().default(""),
});

export const updateSocietySchema = z
  .object({
    name: nonEmptyString("name").max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    email: z.string().trim().toLowerCase().email("Invalid email").optional(),
    phone: z.string().trim().max(30).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// ===== Announcements =====
export const createAnnouncementSchema = z.object({
  title: nonEmptyString("title").max(200),
  message: nonEmptyString("message").max(5000),
  societyId: objectIdString.optional(),
});

// ===== Admin =====
export const societyDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"], {
    errorMap: () => ({
      message: "decision must be 'approved' or 'rejected'",
    }),
  }),
});

// ===== Queries =====
export const createQuerySchema = z.object({
  message: nonEmptyString("message").max(2000),
});

export const replyToQuerySchema = z.object({
  reply: nonEmptyString("reply").max(2000),
});

// ===== Users =====
export const updateUserSchema = z.object({
  name: nonEmptyString("name").max(100),
});
