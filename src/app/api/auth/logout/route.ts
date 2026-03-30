import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("csrf_token")?.value;
  const csrfHeader = req.headers.get("X-CSRF-Token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  cookieStore.delete("session_token");
  cookieStore.delete("csrf_token");
  return NextResponse.json({ ok: true });
}
