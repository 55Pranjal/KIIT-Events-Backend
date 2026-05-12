/**
 * Generic body validator backed by zod schemas.
 *
 * Usage:
 *   router.post("/", validate(myBodySchema), handler);
 *
 * On success: replaces req.body with the parsed (and coerced) value, so the
 * handler can trust types without re-checking.
 * On failure: responds 400 with { message, errors: [{ path, message }] }.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const first = errors[0];
    return res.status(400).json({
      message: first
        ? `${first.path ? first.path + ": " : ""}${first.message}`
        : "Invalid request body",
      errors,
    });
  }
  req.body = result.data;
  next();
};
