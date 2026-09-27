import "server-only";
import { NextResponse } from "next/server";
import { Unauthorized } from "./session";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

/** Wrap a route handler so auth + unexpected errors turn into clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof Unauthorized) return fail("Not signed in", 401);
      console.error(e);
      return fail(e instanceof Error ? e.message : "Server error", 500);
    }
  };
}
