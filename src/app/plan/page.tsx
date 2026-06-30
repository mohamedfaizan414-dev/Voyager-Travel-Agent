import PlannerClient from "@/components/planner/PlannerClient";

export default function PlanPage() {
  return (
    <main className="route-grid min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-4xl text-paper md:text-5xl">
          Tell Voyager about your trip
        </h1>
        <p className="mt-3 max-w-xl text-paper/60">
          Mention where you want to go, roughly when, who&apos;s coming, and your budget if you have
          one in mind. The agent fills in anything you skip.
        </p>
        <PlannerClient />
      </div>
    </main>
  );
}
