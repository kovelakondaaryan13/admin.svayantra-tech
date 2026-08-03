/** Typed domain errors, mapped to HTTP status codes by lib/http.ts. */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class Unauthorized extends AppError {
  constructor(message = "unauthenticated") {
    super(message, 401, "unauthorized");
  }
}

export class Forbidden extends AppError {
  constructor(message = "forbidden") {
    super(message, 403, "forbidden");
  }
}

export class NotFound extends AppError {
  constructor(message = "not found") {
    super(message, 404, "not_found");
  }
}

export class Conflict extends AppError {
  constructor(message = "conflict") {
    super(message, 409, "conflict");
  }
}

export class BusinessRule extends AppError {
  constructor(message: string) {
    super(message, 422, "business_rule");
  }
}
