import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateGuestToken } from "@/lib/guest";
import { bookTrip } from "@/lib/agent/booking";

async function authorizeTrip(id: string) {
  const session = await auth();
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;
  const guestToken = userId ? null : await getOrCreateGuestToken();

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { itineraries: { orderBy: { dayNumber: "asc" } }, bookings: true, messages: true },
  });

  if (!trip) return { trip: null, ok: false };
  const ok = (userId && trip.userId === userId) || (!userId && trip.guestToken === guestToken);
  return { trip, ok };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trip, ok } = await authorizeTrip(id);
  if (!trip || !ok) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  return NextResponse.json({ trip });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Booking action: { action: "book", flight, hotel, activities }
  const { id } = await params;
  const { trip, ok } = await authorizeTrip(id);
  if (!trip || !ok) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to confirm bookings." },
      { status: 401 }
    );
  }

  const body = await req.json();
  if (body.action !== "book") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const bookingResult = await bookTrip({
    tripId: id,
    flight: body.flight ?? null,
    hotel: body.hotel ?? null,
    activities: body.activities ?? [],
  });

  return NextResponse.json(bookingResult);
}
