"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Trash2, Loader2, Plus, Plane } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  destination: string;
  origin: string | null;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  status: string;
  coverImageUrl: string | null;
  createdAt: string;
  bookings: { id: string; type: string; status: string }[];
  itineraries: { dayNumber: number }[];
}

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "bg-teal/15 text-teal border-teal/30",
  BOOKED: "bg-brass/15 text-brass border-brass/30",
  DRAFT: "bg-white/5 text-paper/50 border-white/10",
  CANCELLED: "bg-coral/10 text-coral border-coral/30",
  COMPLETED: "bg-white/10 text-paper/60 border-white/15",
};

export default function TripsClient() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trips");
      const data = await res.json();
      setTrips(data.trips ?? []);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  async function deleteTrip(id: string) {
    setDeleting(id);
    try {
      await fetch("/api/trips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-16 flex items-center gap-3 text-paper/50">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading your trips…
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="mt-16 rounded-2xl border border-white/5 bg-ink-700/30 p-12 text-center">
        <Plane className="mx-auto h-10 w-10 text-paper/20" strokeWidth={1.25} />
        <p className="mt-4 text-lg text-paper/60">No trips yet.</p>
        <p className="mt-1 text-sm text-paper/40">Plan your first trip and it will appear here.</p>
        <Link
          href="/plan"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brass px-5 py-2.5 text-sm font-medium text-ink-900 transition hover:bg-brass-light"
        >
          <Plus className="h-4 w-4" /> Plan a trip
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-4">
      {trips.map((trip) => (
        <div
          key={trip.id}
          className="group ticket flex flex-col gap-4 px-6 py-5 transition hover:border-brass/30 md:flex-row md:items-center md:justify-between"
        >
          {trip.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trip.coverImageUrl}
              alt={trip.title}
              className="h-20 w-full rounded-xl object-cover md:w-28 md:shrink-0"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl text-paper">{trip.title}</h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[trip.status] ?? STATUS_STYLES.DRAFT}`}
              >
                {trip.status}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-paper/50">
              {trip.origin && (
                <span className="flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5" />
                  {trip.origin} → {trip.destination}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {trip.destination}
              </span>
              {trip.startDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {trip.endDate && (
                    <> – {new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                  )}
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-3 text-xs text-paper/40">
              <span>{trip.itineraries.length} days planned</span>
              <span>{trip.bookings.length} booking{trip.bookings.length !== 1 ? "s" : ""}</span>
              <span>{trip.travelers} traveler{trip.travelers !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/trip/${trip.id}`}
              className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-paper/80 transition hover:border-brass/40 hover:text-paper"
            >
              View
            </Link>
            <button
              onClick={() => deleteTrip(trip.id)}
              disabled={deleting === trip.id}
              className="rounded-full border border-white/10 p-2 text-paper/40 transition hover:border-coral/40 hover:text-coral disabled:opacity-40"
              aria-label="Delete trip"
            >
              {deleting === trip.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ))}

      <Link
        href="/plan"
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-paper/70 transition hover:border-brass/40 hover:text-paper"
      >
        <Plus className="h-4 w-4" /> Plan another trip
      </Link>
    </div>
  );
}
