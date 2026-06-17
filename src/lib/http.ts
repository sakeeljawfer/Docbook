import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function ok<T>(data: T) {
  return NextResponse.json(data);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
