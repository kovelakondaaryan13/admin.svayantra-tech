/**
 * Consistent HTTP response envelope and error mapping for route handlers.
 * Canonical pattern: .claude/patterns/api-pattern.md
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "validation failed", code: "validation", issues: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  // Never leak internals (stack traces, Mongo errors) to the client.
  console.error("[unhandled]", err);
  return NextResponse.json({ error: "internal error", code: "internal" }, { status: 500 });
}
