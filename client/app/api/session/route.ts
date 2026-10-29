import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/get-user";

export async function GET() {
  const user = await getUserSession();
  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
