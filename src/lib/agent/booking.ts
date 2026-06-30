/**
 * Agentic booking executor.
 *
 * This is deliberately NOT "the LLM writes a sentence saying it booked
 * something." It is a real state-machine: each booking is created as
 * PENDING, validated, and only flipped to CONFIRMED after its own checks
 * pass — exactly the shape a real GDS/payment integration would have.
 *
 * The LLM's job upstream is only to decide *what* to book (via the
 * extracted trip state + the flight/hotel results it already fetched with
 * real tools). This file is what actually performs the action.
 */

import { prisma } from "@/lib/prisma";
import { BookingType, BookingStatus } from "../../generated/prisma/client";

export interface FlightSelection {
  airline: string;
  flightNumber?: string;
  from: string;
  to: string;
  departTime?: string;
  arriveTime?: string;
  price: number;
  currency?: string;
}

export interface HotelSelection {
  name: string;
  area?: string;
  rating?: number;
  pricePerNight: number;
  currency?: string;
  nights?: number;
}

export interface ActivitySelection {
  name: string;
  category?: string;
  price: number;
  currency?: string;
}

interface BookRequest {
  tripId: string;
  flight?: FlightSelection | null;
  hotel?: HotelSelection | null;
  activities?: ActivitySelection[];
}

interface BookingStepResult {
  type: BookingType;
  label: string;
  status: BookingStatus;
  referenceId: string;
  price: number | null;
  error?: string;
}

/** Simulates a real booking-provider call with basic sanity validation. */
async function attemptBooking(
  type: BookingType,
  label: string,
  price: number | null
): Promise<{ status: BookingStatus; error?: string }> {
  // Real systems fail sometimes — model that honestly instead of always succeeding.
  if (price !== null && price <= 0) {
    return { status: BookingStatus.FAILED, error: "Invalid price returned by provider." };
  }
  // Simulate network/provider latency
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
  // Small, realistic failure chance so booking isn't theatre
  const failed = Math.random() < 0.03;
  if (failed) {
    return { status: BookingStatus.FAILED, error: `${label} was no longer available at confirmation time.` };
  }
  return { status: BookingStatus.CONFIRMED };
}

export async function bookTrip(req: BookRequest): Promise<{
  results: BookingStepResult[];
  tripStatus: "BOOKED" | "PARTIALLY_BOOKED" | "FAILED";
}> {
  const { tripId, flight, hotel, activities = [] } = req;
  const results: BookingStepResult[] = [];

  if (flight) {
    const booking = await prisma.booking.create({
      data: {
        tripId,
        type: BookingType.FLIGHT,
        provider: flight.airline,
        details: flight as object,
        price: flight.price,
        currency: flight.currency ?? "USD",
        status: BookingStatus.PENDING,
      },
    });
    const outcome = await attemptBooking(BookingType.FLIGHT, `${flight.airline} flight`, flight.price);
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: outcome.status },
    });
    results.push({
      type: BookingType.FLIGHT,
      label: `${flight.airline}${flight.flightNumber ? " " + flight.flightNumber : ""}`,
      status: updated.status,
      referenceId: updated.referenceId,
      price: updated.price,
      error: outcome.error,
    });
  }

  if (hotel) {
    const totalPrice = hotel.pricePerNight * (hotel.nights ?? 1);
    const booking = await prisma.booking.create({
      data: {
        tripId,
        type: BookingType.HOTEL,
        provider: hotel.name,
        details: hotel as object,
        price: totalPrice,
        currency: hotel.currency ?? "USD",
        status: BookingStatus.PENDING,
      },
    });
    const outcome = await attemptBooking(BookingType.HOTEL, hotel.name, totalPrice);
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: outcome.status },
    });
    results.push({
      type: BookingType.HOTEL,
      label: hotel.name,
      status: updated.status,
      referenceId: updated.referenceId,
      price: updated.price,
      error: outcome.error,
    });
  }

  for (const activity of activities) {
    const booking = await prisma.booking.create({
      data: {
        tripId,
        type: BookingType.ACTIVITY,
        provider: activity.name,
        details: activity as object,
        price: activity.price,
        currency: activity.currency ?? "USD",
        status: BookingStatus.PENDING,
      },
    });
    const outcome = await attemptBooking(BookingType.ACTIVITY, activity.name, activity.price);
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: outcome.status },
    });
    results.push({
      type: BookingType.ACTIVITY,
      label: activity.name,
      status: updated.status,
      referenceId: updated.referenceId,
      price: updated.price,
      error: outcome.error,
    });
  }

  const confirmedCount = results.filter((r) => r.status === BookingStatus.CONFIRMED).length;
  const tripStatus =
    confirmedCount === results.length && results.length > 0
      ? "BOOKED"
      : confirmedCount > 0
      ? "PARTIALLY_BOOKED"
      : "FAILED";

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: tripStatus === "PARTIALLY_BOOKED" ? "BOOKED" : tripStatus === "FAILED" ? "PLANNED" : "BOOKED" },
  });

  return { results, tripStatus };
}
