export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Please login to continue') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have access to this action') { return new ApiError(403, msg); }
  static notFound(msg = 'Record not found') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict') { return new ApiError(409, msg); }
}
