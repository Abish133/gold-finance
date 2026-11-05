/** Express 5 already forwards rejected promises, kept for explicit intent. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
