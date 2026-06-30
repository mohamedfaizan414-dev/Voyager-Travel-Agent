import Link from "next/link";
import { ArrowRight, Plane, Hotel, MapPinned, ShieldCheck, Sparkles, Wallet } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="route-grid relative overflow-hidden border-b border-white/5 px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-3 py-1 text-xs uppercase tracking-widest text-brass">
              <Sparkles className="h-3.5 w-3.5" /> Agentic trip planning
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-paper md:text-6xl">
              Say where.
              <br />
              <span className="italic text-brass">Voyager</span> does the rest.
            </h1>
            <p className="mt-6 max-w-md text-lg text-paper/70">
              Tell it your trip in plain words. It interprets the request, searches flights and
              hotels, builds a day-by-day itinerary, and can confirm every booking — without you
              opening a single other tab.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/plan"
                className="group inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 font-medium text-ink-900 transition hover:bg-coral-light"
              >
                Plan my trip
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <span className="text-sm text-paper/50">No account needed to try it</span>
            </div>
          </div>

          {/* Signature: animated flight-path ticket */}
          <div className="ticket relative px-8 py-10 animate-fade-up">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-paper/50">
              <span>Boarding pass</span>
              <span className="font-mono">VOY-AI</span>
            </div>

            <svg viewBox="0 0 400 120" className="mt-6 w-full" aria-hidden="true">
              <circle cx="20" cy="60" r="5" fill="#D4A24C" />
              <circle cx="380" cy="60" r="5" fill="#FF6B4A" />
              <path
                d="M20,60 C140,10 260,110 380,60"
                fill="none"
                stroke="#D4A24C"
                strokeWidth="2"
                className="flight-path animate-dash-draw"
                style={{ strokeDasharray: 1000, strokeDashoffset: 1000 }}
              />
              <g transform="translate(195,40)">
                <Plane size={20} color="#EFE9DA" />
              </g>
            </svg>

            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="font-mono text-xs text-paper/40">FROM</p>
                <p className="font-display text-2xl">Wherever</p>
              </div>
              <Plane className="h-5 w-5 rotate-90 text-paper/30" />
              <div className="text-right">
                <p className="font-mono text-xs text-paper/40">TO</p>
                <p className="font-display text-2xl">Anywhere</p>
              </div>
            </div>

            <div className="mt-8 border-t border-dashed border-brass/30 pt-4">
              <div className="barcode">
                {Array.from({ length: 48 }).map((_, i) => (
                  <span key={i} style={{ opacity: (i % 5) / 5 + 0.2 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-display text-3xl text-paper md:text-4xl">
            One agent, the whole trip.
          </h2>
          <p className="mt-3 max-w-xl text-paper/60">
            Each capability below runs as a step in a real LangGraph workflow — not a static
            template.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: MapPinned,
                title: "Understands your request",
                desc: "Free text in, structured trip brief out — destination, dates, budget, travel style.",
              },
              {
                icon: Plane,
                title: "Finds flights",
                desc: "Compares options by price, duration and stops, and explains the trade-offs.",
              },
              {
                icon: Hotel,
                title: "Finds hotels",
                desc: "Matches stays to your budget and the neighborhoods worth being in.",
              },
              {
                icon: Sparkles,
                title: "Builds the itinerary",
                desc: "A themed, day-by-day plan grounded in real activity options for your destination.",
              },
              {
                icon: Wallet,
                title: "Tracks the budget",
                desc: "Running cost estimate across flights, stay and activities as it plans.",
              },
              {
                icon: ShieldCheck,
                title: "Books it for you",
                desc: "One confirm and every reservation is created and tracked under your trip.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/5 bg-ink-700/40 p-6 transition hover:border-brass/30"
              >
                <f.icon className="h-6 w-6 text-brass" strokeWidth={1.6} />
                <h3 className="mt-4 font-display text-xl">{f.title}</h3>
                <p className="mt-2 text-sm text-paper/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl">Where to, first?</h2>
            <p className="mt-2 text-paper/60">Try it free — no sign-in required to see a full plan.</p>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 rounded-full bg-brass px-6 py-3 font-medium text-ink-900 transition hover:bg-brass-light"
          >
            Start planning <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
