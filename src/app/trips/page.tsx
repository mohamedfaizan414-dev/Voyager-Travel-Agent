import TripsClient from "@/components/TripsClient";

export default function TripsPage() {
  return (
    <main className="route-grid min-h-screen px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-4xl text-paper md:text-5xl">My trips</h1>
        <p className="mt-3 text-paper/60">All your planned and booked trips in one place.</p>
        <TripsClient />
      </div>
    </main>
  );
}
