import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateGuestToken, getGuestRunCount, guestRunsRemaining, GUEST_FREE_RUNS } from "@/lib/guest";

export async function GET() {
  const session = await auth();
  if (session?.user) {
    return NextResponse.json({ isGuest: false, remaining: null, limit: GUEST_FREE_RUNS });
  }
  const token = await getOrCreateGuestToken();
  const used = await getGuestRunCount(token);
  return NextResponse.json({ isGuest: true, remaining: guestRunsRemaining(used), limit: GUEST_FREE_RUNS });
}
