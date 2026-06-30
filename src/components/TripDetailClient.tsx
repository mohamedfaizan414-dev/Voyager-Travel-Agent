"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2, ArrowLeft, Plane, Hotel, MapPin, CalendarDays,
  Users, Wallet, CheckCircle2, Clock, XCircle, ImagePlus, Send, Sparkles,
} from "lucide-react";

interface Itinerary {
  dayNumber: number;
  summary: string | null;
  items: { markdown?: string } | unknown;
}

interface Booking {
  id: string;
  type: string;
  provider: string | null;
  referenceId: string;
  price: number | null;
  currency: string;
  status: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  origin: string | null;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  budget: number | null;
  status: string;
  coverImageUrl: string | null;
  createdAt: string;
  itineraries: Itinerary[];
  bookings: Booking[];
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const BOOKING_ICONS: Record<string, React.ElementType> = {
  FLIGHT: Plane,
  HOTEL: Hotel,
  ACTIVITY: MapPin,
};

const BOOKING_STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "text-teal",
  PENDING: "text-brass",
  FAILED: "text-coral",
  CANCELLED: "text-paper/40",
};

export default function TripDetailClient({ tripId }: { tripId: string }) {
  const { data: session } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Inline agent chat — this is how booking actually happens, agentically
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) { setNotFound(true); return; }
      const { trip: t } = await res.json();
      setTrip(t);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, chatLoading]);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !trip) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tripId", trip.id);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setTrip((prev) => prev ? { ...prev, coverImageUrl: data.url } : prev);
    } finally {
      setUploading(false);
    }
  }

  async function sendChat(text?: string) {
    const content = (text ?? chatInput).trim();
    if (!content || chatLoading) return;
    setChatMessages((prev) => [...prev, { role: "user", content }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, tripId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "Something went wrong." }]);
        return;
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      // Refresh trip in case a booking tool ran
      fetchTrip();
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-paper/50 pt-20">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading trip…
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="pt-20 text-center">
        <p className="text-paper/60">Trip not found.</p>
        <Link href="/trips" className="mt-4 inline-block text-brass underline">← Back to trips</Link>
      </div>
    );
  }

  const itineraryMarkdown = trip.itineraries[0]?.items as { markdown?: string } | undefined;

  return (
    <div className="space-y-10 animate-fade-up">
      <Link href="/trips" className="inline-flex items-center gap-1.5 text-sm text-paper/50 transition hover:text-paper">
        <ArrowLeft className="h-4 w-4" /> All trips
      </Link>

      {/* Header */}
      <div className="ticket overflow-hidden">
        {trip.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.coverImageUrl} alt={trip.title} className="h-52 w-full object-cover" />
        )}
        <div className="px-7 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-paper">{trip.title}</h1>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-paper/60">
                {trip.origin && trip.origin !== "Not specified" && (
                  <span className="flex items-center gap-1.5">
                    <Plane className="h-4 w-4 text-brass" /> {trip.origin} → {trip.destination}
                  </span>
                )}
                {trip.startDate && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-brass" />
                    {new Date(trip.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {trip.endDate && (
                      <> – {new Date(trip.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</>
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-brass" /> {trip.travelers} traveler{trip.travelers !== 1 ? "s" : ""}
                </span>
                {trip.budget && (
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-brass" /> Budget: ${trip.budget}
                  </span>
                )}
              </div>
            </div>

            {session?.user && (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-paper/60 transition hover:border-brass/40 hover:text-paper">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {trip.coverImageUrl ? "Change cover" : "Add cover photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Bookings", value: trip.bookings.length },
          { label: "Confirmed", value: trip.bookings.filter((b) => b.status === "CONFIRMED").length },
          { label: "Status", value: trip.status },
          { label: "Created", value: new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-ink-700/40 px-4 py-3 text-center">
            <p className="font-mono text-xl text-paper">{s.value}</p>
            <p className="mt-1 text-xs text-paper/50">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bookings */}
      {trip.bookings.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-paper">Bookings</h2>
          <div className="mt-4 space-y-3">
            {trip.bookings.map((b) => {
              const Icon = BOOKING_ICONS[b.type] ?? MapPin;
              return (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-700/30 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-brass shrink-0" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm text-paper">{b.provider ?? b.type}</p>
                      <p className="font-mono text-xs text-paper/40">Ref: {b.referenceId.slice(0, 12)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {b.price && <span className="font-mono text-paper">${b.price.toFixed(0)}</span>}
                    <span className={`flex items-center gap-1 ${BOOKING_STATUS_STYLE[b.status] ?? "text-paper/50"}`}>
                      {b.status === "CONFIRMED" ? <CheckCircle2 className="h-4 w-4" /> :
                       b.status === "PENDING" ? <Clock className="h-4 w-4" /> :
                       <XCircle className="h-4 w-4" />}
                      {b.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Itinerary */}
      {itineraryMarkdown?.markdown && (
        <section>
          <h2 className="font-display text-2xl text-paper">Itinerary</h2>
          <div className="ticket mt-4 px-7 py-7 prose-invert max-w-none [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-paper [&_h3]:text-brass [&_table]:w-full [&_th]:text-left [&_strong]:text-brass">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{itineraryMarkdown.markdown}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* Agentic chat — talk to Voyager about this trip, including booking */}
      <section>
        <h2 className="font-display text-2xl text-paper">Talk to Voyager about this trip</h2>
        <p className="mt-1 text-sm text-paper/50">
          Ask it to re-check prices, adjust the plan, or say something like
          “book the recommended flight” — it will actually create the booking.
        </p>

        <div className="ticket mt-4 px-6 py-6">
          {chatMessages.length > 0 && (
            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto scrollbar-thin pr-1">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-coral text-ink-900" : "border border-white/5 bg-ink-700/50 text-paper/90"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose-invert prose-sm max-w-none [&_p]:my-1 [&_strong]:text-brass">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-ink-700/50 px-4 py-2.5 text-sm text-paper/60">
                    <Loader2 className="h-4 w-4 animate-spin text-brass" /> Working on it…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          <div className="flex items-end gap-3">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              rows={1}
              placeholder="e.g. Book the cheapest flight option"
              className="flex-1 resize-none bg-transparent text-sm text-paper placeholder:text-paper/30 focus:outline-none"
            />
            <button
              onClick={() => sendChat()}
              disabled={chatLoading || !chatInput.trim() || !session?.user}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-coral-light disabled:opacity-50"
            >
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {!session?.user && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-paper/40">
              <Sparkles className="h-3 w-3" /> Sign in to chat and book from this page.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
