/** Typed application errors that map cleanly onto HTTP status codes. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  unauthorized: (message = 'You need to sign in to do that.') =>
    new AppError(message, 401, 'unauthorized'),
  forbidden: (message = 'You do not have permission to do that.') =>
    new AppError(message, 403, 'forbidden'),
  notFound: (message = 'Not found.') => new AppError(message, 404, 'not_found'),
  conflict: (message = 'That already exists.') => new AppError(message, 409, 'conflict'),
  badRequest: (message = 'Invalid request.', details?: unknown) =>
    new AppError(message, 400, 'bad_request', details),
  rateLimited: (message = 'Slow down a little.') => new AppError(message, 429, 'rate_limited'),
  blocked: (message = 'This conversation is unavailable.') => new AppError(message, 403, 'blocked'),
};
