import { ApiError } from '#utils/ApiError.js';

/** validate(zodSchema, 'body' | 'query') -> parsed data on req.body / req.validQuery */
export const validate = (schema, target = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[target] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const first = details[0];
    throw ApiError.badRequest(first ? `${first.field || 'input'}: ${first.message}` : 'Invalid input', details);
  }
  if (target === 'query') req.validQuery = result.data;
  else req[target] = result.data;
  next();
};
