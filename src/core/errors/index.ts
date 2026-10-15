export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, 400);
    this.errors = errors;
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, 500);
    if (originalError) {
      this.stack = `${this.stack}\nCaused By: ${String(originalError)}`;
    }
  }
}

export class ParsingError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class AIError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}
