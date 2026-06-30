"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2, Send, Sparkles, Plane, CalendarDays,
  Users, Wallet, CheckCircle2, ArrowRight,
} from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLES = [
  "A relaxed 5-day trip to Lisbon for two, mid-September, budget around $2500",
  "Solo backpacking week in Vietnam, love street food and cheap stays",
  "Romantic long weekend in Kyoto for our anniversary, comfortable hotels",
];

interface ExtractedTrip {
  current_location: string | null;
  destination: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget: number | null;
  travelers: number | null;
}

export default function PlannerClient() {
  const { data: session } = useSession();
  const router = useRouter();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedTrip | null>(null);
  const [stage, setStage] = useState<string>("active");
  const [itinerary, setItinerary] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setError(null);
    setLimitReached(false);
    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, tripId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "guest_limit_reached") setLimitReached(true);
        setError(data.message || "Something went wrong.");
        setMessages((prev) => prev.slice(0, -1)); // roll back the optimistic user message
        return;
      }

      setTripId(data.tripId);
      setExtracted(data.extracted);
      setStage(data.stage);
      setItinerary(data.itinerary);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Couldn't reach the planning agent. Check your connection and try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function goToTrip() {
    if (!session?.user) {
      router.push(`/auth/signin?callbackUrl=/trip/${tripId}`);
      return;
    }
    if (tripId) router.push(`/trip/${tripId}`);
  }

  return (
    <div className="mt-10">
      {/* Conversation */}
      {messages.length > 0 && (
        <div className="mb-6 max-h-[480px] space-y-4 overflow-y-auto scrollbar-thin pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-coral text-ink-900"
                    : "border border-white/5 bg-ink-700/50 text-paper/90"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose-invert prose-sm max-w-none [&_p]:my-1 [&_strong]:text-brass">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-ink-700/50 px-4 py-3 text-sm text-paper/60">
                <Loader2 className="h-4 w-4 animate-spin text-brass" />
                Voyager is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Extracted trip summary chips */}
      {extracted && (extracted.destination || extracted.budget || extracted.travelers) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {extracted.current_location && extracted.destination && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-700/40 px-3 py-1 text-xs text-paper/70">
              <Plane className="h-3 w-3 text-brass" /> {extracted.current_location} → {extracted.destination}
            </span>
          )}
          {extracted.departure_date && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-700/40 px-3 py-1 text-xs text-paper/70">
              <CalendarDays className="h-3 w-3 text-brass" />
              {extracted.departure_date}
              {extracted.return_date && ` – ${extracted.return_date}`}
            </span>
          )}
          {extracted.travelers && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-700/40 px-3 py-1 text-xs text-paper/70">
              <Users className="h-3 w-3 text-brass" /> {extracted.travelers} traveler(s)
            </span>
          )}
          {extracted.budget && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-700/40 px-3 py-1 text-xs text-paper/70">
              <Wallet className="h-3 w-3 text-brass" /> ${extracted.budget} budget
            </span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="ticket px-6 py-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            messages.length === 0
              ? "A week in northern Italy this October for two adults, food-focused, mid-range budget..."
              : "Reply to Voyager…"
          }
          rows={messages.length === 0 ? 3 : 2}
          className="w-full resize-none bg-transparent text-lg text-paper placeholder:text-paper/30 focus:outline-none"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-paper/50 transition hover:border-brass/40 hover:text-paper/80"
                >
                  {ex.slice(0, 32)}…
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-paper/30">Press Enter to send, Shift+Enter for new line</span>
          )}
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 font-medium text-ink-900 transition hover:bg-coral-light disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {messages.length === 0 ? "Start planning" : "Send"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral-light">
          {error}
          {limitReached && (
            <>
              {" "}
              <a href="/auth/signin?callbackUrl=/plan" className="underline">
                Sign in to continue
              </a>
              .
            </>
          )}
        </div>
      )}

      {/* Full itinerary reveal */}
      {stage === "complete" && itinerary && (
        <div className="mt-10 animate-fade-up space-y-6">
          <div className="ticket px-7 py-7 prose-invert max-w-none [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-paper [&_h3]:text-brass [&_table]:w-full [&_th]:text-left [&_td]:py-1 [&_strong]:text-brass">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{itinerary}</ReactMarkdown>
          </div>

          <div className="rounded-2xl border border-brass/20 bg-brass/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-paper/80">
                <CheckCircle2 className="h-5 w-5 text-teal" />
                Your itinerary is ready. Open the trip page to confirm flight, hotel and activity bookings.
              </p>
              <button
                onClick={goToTrip}
                className="inline-flex items-center gap-2 rounded-full bg-brass px-5 py-2.5 font-medium text-ink-900 transition hover:bg-brass-light"
              >
                {session?.user ? "Go to trip & book" : "Sign in to book"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-paper/30">
          <Sparkles className="h-3.5 w-3.5" /> Voyager uses real flight, hotel, weather and map data — not guesses.
        </p>
      )}
    </div>
  );
}
