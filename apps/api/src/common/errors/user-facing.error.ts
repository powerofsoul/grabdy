/**
 * Throw this error from services when you want the message
 * shown directly to the end user.  Every other unhandled error
 * will be replaced with "Something went wrong" by the global
 * exception filter.
 */
export class UserFacingError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'UserFacingError';
    this.statusCode = statusCode;
  }
}
