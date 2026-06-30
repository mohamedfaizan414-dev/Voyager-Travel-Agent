import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTravelAgent } from "@/lib/agent/graph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import {
  getOrCreateGuestToken,
  getGuestRunCount,
  incrementGuestRunCount,
  guestRunsRemaining,
  GUEST_FREE_RUNS,
} from "@/lib/guest";

interface AgentStateShape {
  current_location: string | null;
  destination: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget: number | null;
  travelers: number | null;
  validation_issue: Record<string, unknown> | null;
  stage: string;
  itinerary: string | null;
}

function toLangchainHistory(
  messages: { role: string; content: string }[]
): BaseMessage[] {
  return messages.map((m) =>
    m.role === "USER" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );
}

export async function POST(req: NextRequest) {
  try {
    const { message, tripId: incomingTripId } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return NextResponse.json({ error: "Tell me a bit more." }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;

    // ─── Guest rate limiting (only applies to starting NEW trips) ─────────────
    let guestToken: string | null = null;
    if (!userId) {
      guestToken = await getOrCreateGuestToken();
      if (!incomingTripId) {
        const used = await getGuestRunCount(guestToken);
        if (used >= GUEST_FREE_RUNS) {
          return NextResponse.json(
            {
              error: "guest_limit_reached",
              message: `You've used your ${GUEST_FREE_RUNS} free trip plans. Sign in to keep planning and to book.`,
            },
            { status: 403 }
          );
        }
      }
    }

    // ─── Load or create the trip (acts as the conversation thread) ───────────
    let trip;
    if (incomingTripId) {
      trip = await prisma.trip.findUnique({
        where: { id: incomingTripId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      const owns =
        (userId && trip.userId === userId) || (!userId && trip.guestToken === guestToken);
      if (!owns) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    } else {
      trip = await prisma.trip.create({
        data: {
          userId: userId ?? null,
          guestToken: userId ? null : guestToken,
          title: "New trip",
          destination: "Not specified",
          status: "PLANNING",
        },
        include: { messages: true },
      });
    }

    const existingState = (trip.agentState as Partial<AgentStateShape>) ?? {};
    const history = toLangchainHistory(
      trip.messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
    );

    // Persist the user's message immediately
    await prisma.message.create({
      data: { tripId: trip.id, role: "USER", content: message },
    });

    // ─── Run the agentic graph ─────────────────────────────────────────────────
    const result = await runTravelAgent({
      userMessage: message,
      history,
      tripId: trip.id,
      existingState,
    });

    // Persist assistant reply
    await prisma.message.create({
      data: { tripId: trip.id, role: "ASSISTANT", content: result.reply },
    });

    const newAgentState: AgentStateShape = {
      current_location: result.extracted.current_location,
      destination: result.extracted.destination,
      departure_date: result.extracted.departure_date,
      return_date: result.extracted.return_date,
      budget: result.extracted.budget,
      travelers: result.extracted.travelers,
      validation_issue: null,
      stage: result.stage,
      itinerary: result.itinerary,
    };

    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        agentState: newAgentState as object,
        title: result.extracted.destination
          ? `Trip to ${result.extracted.destination}`
          : trip.title,
        destination: result.extracted.destination ?? trip.destination,
        origin: result.extracted.current_location ?? trip.origin,
        startDate: result.extracted.departure_date
          ? new Date(result.extracted.departure_date)
          : trip.startDate,
        endDate: result.extracted.return_date
          ? new Date(result.extracted.return_date)
          : trip.endDate,
        budget: result.extracted.budget ?? trip.budget,
        travelers: result.extracted.travelers ?? trip.travelers,
        status: result.stage === "complete" ? "PLANNED" : trip.status,
      },
    });

    if (result.itinerary) {
      // Replace any prior itinerary draft with the freshly generated one
      await prisma.itinerary.deleteMany({ where: { tripId: trip.id } });
      await prisma.itinerary.create({
        data: {
          tripId: trip.id,
          dayNumber: 1,
          summary: "Full itinerary",
          items: { markdown: result.itinerary } as object,
        },
      });
    }

    if (guestToken && !incomingTripId) await incrementGuestRunCount(guestToken);

    const remaining = guestToken ? guestRunsRemaining(await getGuestRunCount(guestToken)) : null;

    return NextResponse.json({
      tripId: trip.id,
      reply: result.reply,
      stage: result.stage,
      itinerary: result.itinerary,
      extracted: result.extracted,
      guestRunsRemaining: remaining,
      isGuest: !userId,
    });
  } catch (err) {
    console.error("Agent run failed:", err);
    const msg = err instanceof Error ? err.message : "Something went wrong while planning your trip.";
    return NextResponse.json({ error: "agent_error", message: msg }, { status: 500 });
  }
}
