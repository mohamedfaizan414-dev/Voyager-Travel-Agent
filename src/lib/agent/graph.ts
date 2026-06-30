/**
 * Voyager AI — LangGraph agentic travel workflow
 *
 * Graph topology (mirrors the Python reference):
 *
 *   START → extract → validate → brain ──→ END   (normal turn)
 *                                       ↘
 *                                     final → END  (user confirmed plan)
 *
 * Nodes:
 *   extract  — LLM strips structured trip data from conversation history
 *   validate — pure logic: date ordering, budget sanity checks
 *   brain    — createReactAgent with 6 real tools; decides what to do each turn
 *   final    — createReactAgent generates the full premium day-by-day itinerary
 */

import {
  StateGraph,
  Annotation,
  START,
  END,
  messagesStateReducer,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { allTools, makeBookingTools } from "./tools";

// ─── State ───────────────────────────────────────────────────────────────────

const overwrite = <T>(def: T) =>
  Annotation<T>({ reducer: (_, v) => v, default: () => def });

export const TravelState = Annotation.Root({
  // full conversation; uses LangGraph's built-in add_messages reducer
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  // extracted trip details — all overwrite on each extract pass
  current_location: overwrite<string | null>(null),
  destination: overwrite<string | null>(null),
  departure_date: overwrite<string | null>(null),
  return_date: overwrite<string | null>(null),
  budget: overwrite<number | null>(null),
  travelers: overwrite<number | null>(null),
  // internal control
  validation_issue: overwrite<Record<string, unknown> | null>(null),
  stage: overwrite<string>("active"),
  itinerary: overwrite<string | null>(null),
  // when set, the brain/final nodes get real booking tools bound to this trip
  tripId: overwrite<string | null>(null),
});

export type TVState = typeof TravelState.State;

// ─── LLM / Agent factory ─────────────────────────────────────────────────────

function makeLLM(temperature = 0) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing. Add it to your .env file.");
  }
  return new ChatGroq({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY,
    temperature,
  });
}

function makeAgent(extraTools: ReturnType<typeof makeBookingTools> = []) {
  const llm = makeLLM(0);
  const agent = createReactAgent({ llm, tools: [...allTools, ...extraTools] });
  return { agent };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function msgContent(m: BaseMessage): string {
  if (typeof m.content === "string") return m.content;
  return JSON.stringify(m.content);
}

function safeJSON(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  // try the whole string first, then find the first {...} block
  for (const candidate of [cleaned, (cleaned.match(/\{[\s\S]*\}/) ?? [])[0] ?? ""]) {
    try {
      if (candidate) return JSON.parse(candidate) as Record<string, unknown>;
    } catch { /* keep trying */ }
  }
  return {};
}

function validateDates(
  dep: string | null,
  ret: string | null
): Record<string, unknown> | null {
  if (!dep) return null;
  const depD = new Date(dep);
  if (isNaN(depD.getTime())) {
    return { type: "DATE_ERROR", field: "departure_date", reason: "Invalid date format" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (depD < today) {
    return { type: "DATE_ERROR", field: "departure_date", reason: "Departure date is in the past" };
  }
  if (ret) {
    const retD = new Date(ret);
    if (isNaN(retD.getTime())) {
      return { type: "DATE_ERROR", field: "return_date", reason: "Invalid return date format" };
    }
    if (retD <= depD) {
      return {
        type: "DATE_LOGIC_ERROR",
        reason: "Return date must be after departure date",
        departure: dep,
        return: ret,
      };
    }
  }
  return null;
}

// ─── Node 1: extract ─────────────────────────────────────────────────────────

async function extractNode(state: TVState): Promise<Partial<TVState>> {
  const today = new Date().toISOString().slice(0, 10);
  const recentText = state.messages
    .slice(-8)
    .map((m) => `${m._getType()}: ${msgContent(m)}`)
    .join("\n");

  const prompt = `Today is ${today}.

Extract travel details from the conversation below.
Return ONLY a JSON object — no prose, no code fences:
{
  "current_location": string | null,
  "destination": string | null,
  "departure_date": "YYYY-MM-DD" | null,
  "return_date": "YYYY-MM-DD" | null,
  "budget": number | null,
  "travelers": number | null
}

Conversation:
${recentText}`;

  const res = await makeLLM(0).invoke(prompt);
  const d = safeJSON(typeof res.content === "string" ? res.content : JSON.stringify(res.content));

  // Merge: prefer newly extracted value, fallback to existing state value
  const pick = <T>(key: string, existing: T): T =>
    (d[key] !== undefined && d[key] !== null ? d[key] : existing) as T;

  return {
    current_location: pick("current_location", state.current_location),
    destination: pick("destination", state.destination),
    departure_date: pick("departure_date", state.departure_date),
    return_date: pick("return_date", state.return_date),
    budget: pick("budget", state.budget),
    travelers: pick("travelers", state.travelers),
  };
}

// ─── Node 2: validate ────────────────────────────────────────────────────────

function validateNode(state: TVState): Partial<TVState> {
  const dateIssue = validateDates(state.departure_date, state.return_date);
  if (dateIssue) return { validation_issue: dateIssue };

  const { budget, travelers } = state;
  if (budget !== null && budget < 50) {
    return { validation_issue: { type: "BUDGET_TOO_LOW", minimum: 50, given: budget } };
  }
  if (budget !== null && travelers !== null && travelers > 0 && budget / travelers < 80) {
    return {
      validation_issue: {
        type: "BUDGET_PER_PERSON_TOO_LOW",
        perPerson: Math.round(budget / travelers),
        minimum: 80,
      },
    };
  }
  return { validation_issue: null };
}

// ─── Node 3: thinking brain ──────────────────────────────────────────────────

async function brainNode(state: TVState): Promise<Partial<TVState>> {
  const bookingTools = state.tripId ? makeBookingTools(state.tripId) : [];
  const { agent } = makeAgent(bookingTools);

  const ctx = `
CURRENT TRAVEL CONTEXT (auto-extracted from conversation):
  From        : ${state.current_location ?? "Not specified"}
  To          : ${state.destination ?? "Not specified"}
  Departure   : ${state.departure_date ?? "Not specified"}
  Return      : ${state.return_date ?? "Not specified"}
  Budget      : ${state.budget ? "$" + state.budget : "Not specified"}
  Travelers   : ${state.travelers ?? "Not specified"}
${state.validation_issue ? `\nACTIVE VALIDATION ISSUE:\n${JSON.stringify(state.validation_issue, null, 2)}` : ""}`;

  const bookingInstructions = state.tripId
    ? `
8. You have REAL booking tools available: book_flight, book_hotel, book_activity.
   These perform actual reservations — call them ONLY after the user has explicitly
   confirmed a specific option (e.g. "book the SkyBridge flight", "yes, book that hotel").
   Never call a booking tool speculatively or before confirmation.
   After a booking tool returns, relay its real result (success or failure) honestly —
   never claim something is booked unless the tool said so.`
    : `
8. Booking is not yet available in this conversation — once the user has a full plan,
   tell them they can confirm it from the trip page to book everything.`;

  const systemPrompt = `You are Voyager ✈️, a premium AI travel consultant.

${ctx}

BEHAVIOUR RULES:
1. If there is a validation issue, address it gently and ask the user to correct it.
2. Use tools to provide REAL data. Never fabricate prices, ratings, or availability.
   - weather_tool    → call proactively when destination is known
   - search_flights  → use real IATA codes; infer common ones (Paris = CDG, London = LHR, etc.)
   - search_hotels   → call when accommodation is needed
   - search_map      → find attractions, restaurants, local gems
   - currency_exchanger → convert budget to local currency
   - web_search      → visa requirements, travel advisories, local tips
3. After tool results, interpret them in a friendly human way — never dump raw JSON.
4. If travel details are incomplete, ask for the missing piece naturally in conversation.
5. When the user confirms the plan or says "book it", "finalise", "looks great", "yes proceed":
   respond with exactly the word FINALIZE (and nothing else).
6. Use emojis tastefully. Be warm, expert, and concise.
7. Always present flight / hotel options as a short numbered list so the user can pick.${bookingInstructions}`;

  const result = await agent.invoke({
    messages: [
      new SystemMessage(systemPrompt),
      ...state.messages.slice(-12),
    ],
  });

  const last = result.messages[result.messages.length - 1];
  const content = msgContent(last);

  if (/\bFINALIZE\b/i.test(content)) {
    return {
      messages: [new AIMessage("Perfect! Drafting your personalised itinerary — hold tight ✈️")],
      stage: "finalize",
    };
  }

  return {
    messages: [new AIMessage(content)],
    stage: "active",
  };
}

// ─── Node 4: generate itinerary ───────────────────────────────────────────────

async function finalNode(state: TVState): Promise<Partial<TVState>> {
  const bookingTools = state.tripId ? makeBookingTools(state.tripId) : [];
  const { agent } = makeAgent(bookingTools);

  const prompt = `Create a premium, detailed day-by-day travel itinerary for this trip:

Traveller Details:
  From        : ${state.current_location}
  To          : ${state.destination}
  Departure   : ${state.departure_date}
  Return      : ${state.return_date}
  Total Budget: $${state.budget}
  Travelers   : ${state.travelers}

Steps you MUST follow using your tools:
1. Call weather_tool for ${state.destination} to set the scene
2. Call search_hotels for exact dates to recommend 2–3 stay options
3. Call search_map for top 5 must-see attractions
4. Call search_map for top 5 restaurant recommendations
5. Call web_search for "${state.destination} travel tips ${new Date().getFullYear()}" for practical advice

Then produce:
## ✈️ Your ${state.destination} Itinerary

**Trip Overview**
(brief 2–3 sentence summary)

**Weather & Best Packing Tips**

**Recommended Hotels**
(3 options with price/night and why)

**Day-by-Day Breakdown**
Day 1: [date] — [theme]
  09:00 — ...
  13:00 — ...
  (etc., each day with timing and descriptions)

**🍽 Food Highlights**
(top restaurants with what to order)

**💰 Budget Breakdown**
| Category | Estimated Cost |
|---|---|
| Flights | $... |
| Hotel (N nights) | $... |
| Activities | $... |
| Food | $... |
| Transport | $... |
| **Total** | **$...** |

**🗺 Practical Tips**
(visa, transport, currency, safety, best neighbourhoods)

Make it genuinely useful, specific to ${state.destination}, and worth printing out.`;

  const result = await agent.invoke({
    messages: [new HumanMessage(prompt)],
  });

  const last = result.messages[result.messages.length - 1];
  const content = msgContent(last);

  return {
    itinerary: content,
    messages: [new AIMessage(content)],
    stage: "complete",
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

function router(state: TVState): "final" | typeof END {
  return state.stage === "finalize" ? "final" : END;
}

// ─── Compile ─────────────────────────────────────────────────────────────────

const graph = new StateGraph(TravelState)
  .addNode("extract", extractNode)
  .addNode("validate", validateNode)
  .addNode("brain", brainNode)
  .addNode("final", finalNode)
  .addEdge(START, "extract")
  .addEdge("extract", "validate")
  .addEdge("validate", "brain")
  .addConditionalEdges("brain", router, { final: "final", [END]: END })
  .addEdge("final", END);

export const workflow = graph.compile();

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AgentInput {
  userMessage: string;
  history: BaseMessage[];
  tripId?: string | null;
  existingState?: {
    current_location?: string | null;
    destination?: string | null;
    departure_date?: string | null;
    return_date?: string | null;
    budget?: number | null;
    travelers?: number | null;
    validation_issue?: Record<string, unknown> | null;
    stage?: string;
    itinerary?: string | null;
  };
}

export interface AgentOutput {
  reply: string;
  stage: string;
  itinerary: string | null;
  extracted: {
    current_location: string | null;
    destination: string | null;
    departure_date: string | null;
    return_date: string | null;
    budget: number | null;
    travelers: number | null;
  };
}

export async function runTravelAgent(input: AgentInput): Promise<AgentOutput> {
  const { userMessage, history, existingState = {}, tripId = null } = input;

  const result = await workflow.invoke({
    messages: [...history, new HumanMessage(userMessage)],
    tripId,
    ...existingState,
  });

  // Find the last AIMessage generated in this turn
  const aiMessages = result.messages.filter((m: BaseMessage) => m._getType() === "ai");
  const reply = aiMessages.length > 0 ? msgContent(aiMessages[aiMessages.length - 1]) : "I couldn't generate a response.";

  return {
    reply,
    stage: result.stage ?? "active",
    itinerary: result.itinerary ?? null,
    extracted: {
      current_location: result.current_location,
      destination: result.destination,
      departure_date: result.departure_date,
      return_date: result.return_date,
      budget: result.budget,
      travelers: result.travelers,
    },
  };
}
