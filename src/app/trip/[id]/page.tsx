import TripDetailClient from "@/components/TripDetailClient";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="route-grid min-h-screen px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <TripDetailClient tripId={id} />
      </div>
    </main>
  );
}
