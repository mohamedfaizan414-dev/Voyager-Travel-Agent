import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateGuestToken } from "@/lib/guest";

export async function GET() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;

  let trips;
  if (userId) {
    trips = await prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { bookings: true, itineraries: true },
    });
  } else {
    const guestToken = await getOrCreateGuestToken();
    trips = await prisma.trip.findMany({
      where: { guestToken },
      orderBy: { createdAt: "desc" },
      include: { bookings: true, itineraries: true },
    });
  }

  return NextResponse.json({ trips });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const session = await auth();
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  const guestToken = userId ? null : await getOrCreateGuestToken();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || (userId && trip.userId !== userId) || (!userId && trip.guestToken !== guestToken)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
