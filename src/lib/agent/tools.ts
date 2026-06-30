import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { bookTrip } from "./booking";

// ─── Helper ──────────────────────────────────────────────────────────────────

function missingKey(name: string, envVar: string) {
  return `${name} is not configured. Add ${envVar} to your .env file.`;
}

// ─── 1. WEATHER ───────────────────────────────────────────────────────────────

export const weatherTool = tool(
  async ({ location }: { location: string }): Promise<string> => {
    const key = process.env.WEATHER_API_KEY;
    if (!key) return missingKey("Weather service", "WEATHER_API_KEY");
    try {
      const url = `http://api.weatherstack.com/current?access_key=${key}&query=${encodeURIComponent(location)}`;
      const res = await fetch(url);
      const data = await res.json() as Record<string, unknown>;
      if ((data as { error?: { info: string } }).error) {
        return `Weather error: ${(data as { error: { info: string } }).error.info}`;
      }
      const loc = data.location as Record<string, string>;
      const cur = data.current as Record<string, unknown>;
      const descs = cur.weather_descriptions as string[];
      return (
        `🌤 Live weather for ${loc.name}, ${loc.country}: ${descs[0]}, ` +
        `${cur.temperature}°C (feels like ${cur.feelslike}°C). ` +
        `Humidity: ${cur.humidity}%, Wind: ${cur.wind_speed} km/h.`
      );
    } catch (e) {
      return `Weather error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "weather_tool",
    description:
      "Fetch live current weather for any city. Call this proactively when the destination is known.",
    schema: z.object({
      location: z.string().describe("City name, e.g. 'Paris' or 'Tokyo'"),
    }),
  }
);

// ─── 2. FLIGHTS ───────────────────────────────────────────────────────────────

export const searchFlightsTool = tool(
  async ({
    departure,
    arrival,
    date,
    currency = "USD",
  }: {
    departure: string;
    arrival: string;
    date: string;
    currency?: string;
  }): Promise<string> => {
    const key = process.env.SERP_API_KEY;
    if (!key) return missingKey("Flight search", "SERP_API_KEY");
    try {
      const params = new URLSearchParams({
        engine: "google_flights",
        departure_id: departure.toUpperCase(),
        arrival_id: arrival.toUpperCase(),
        outbound_date: date,
        currency,
        api_key: key,
        hl: "en",
      });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json() as Record<string, unknown>;
      const flights = (data.best_flights as unknown[] | undefined) || (data.other_flights as unknown[] | undefined) || [];
      if (!flights.length) {
        return `No flights found from ${departure} to ${arrival} on ${date}. The route or date may not be available.`;
      }
      const top = (flights as Record<string, unknown>[]).slice(0, 4).map((f, idx) => {
        const legs = f.flights as Record<string, unknown>[] | undefined ?? [];
        const firstLeg = legs[0] as Record<string, unknown> | undefined ?? {};
        const lastLeg = legs[legs.length - 1] as Record<string, unknown> | undefined ?? {};
        const depAirport = firstLeg.departure_airport as Record<string, string> | undefined ?? {};
        const arrAirport = lastLeg.arrival_airport as Record<string, string> | undefined ?? {};
        return {
          option: idx + 1,
          airline: (firstLeg.airline as string | undefined) ?? "Unknown",
          flightNum: (firstLeg.flight_number as string | undefined) ?? "",
          price: `${currency} ${f.price}`,
          duration: `${Math.floor((f.total_duration as number) / 60)}h ${(f.total_duration as number) % 60}m`,
          stops: legs.length - 1 === 0 ? "Nonstop" : `${legs.length - 1} stop(s)`,
          departs: depAirport.time ?? "",
          arrives: arrAirport.time ?? "",
          class: (f.type as string | undefined) ?? "Economy",
        };
      });
      return JSON.stringify(top, null, 2);
    } catch (e) {
      return `Flight search error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "search_flights",
    description:
      "Search real-time flights via Google Flights. Requires IATA airport codes (e.g. DEL, LHR, JFK). If you only have a city name, infer the main airport code or ask the user.",
    schema: z.object({
      departure: z.string().describe("Departure IATA airport code, e.g. 'JFK'"),
      arrival: z.string().describe("Arrival IATA airport code, e.g. 'CDG'"),
      date: z.string().describe("Date in YYYY-MM-DD format"),
      currency: z.string().optional().describe("3-letter currency code, default USD"),
    }),
  }
);

// ─── 3. HOTELS ───────────────────────────────────────────────────────────────

export const searchHotelsTool = tool(
  async ({
    destination,
    checkIn,
    checkOut,
    currency = "USD",
  }: {
    destination: string;
    checkIn: string;
    checkOut: string;
    currency?: string;
  }): Promise<string> => {
    const key = process.env.SERP_API_KEY;
    if (!key) return missingKey("Hotel search", "SERP_API_KEY");
    try {
      const params = new URLSearchParams({
        engine: "google_hotels",
        q: `hotels in ${destination}`,
        check_in_date: checkIn,
        check_out_date: checkOut,
        currency,
        gl: "us",
        hl: "en",
        api_key: key,
      });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json() as Record<string, unknown>;
      const hotels = (data.properties as unknown[] | undefined) ?? [];
      if (!hotels.length) {
        return `No hotels found in ${destination} for ${checkIn} to ${checkOut}.`;
      }
      const top = (hotels as Record<string, unknown>[]).slice(0, 5).map((h, idx) => {
        const rate = h.rate_per_night as Record<string, string> | undefined;
        return {
          option: idx + 1,
          name: h.name,
          rating: h.overall_rating,
          reviewCount: h.reviews,
          pricePerNight: rate?.lowest ?? "N/A",
          type: h.type,
          amenities: (h.amenities as string[] | undefined)?.slice(0, 6) ?? [],
          description: (h.description as string | undefined)?.slice(0, 120),
        };
      });
      return JSON.stringify(top, null, 2);
    } catch (e) {
      return `Hotel search error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "search_hotels",
    description:
      "Search real hotel availability and prices. Call when the user asks about accommodation or when building a full plan.",
    schema: z.object({
      destination: z.string().describe("City or area, e.g. 'Rome, Italy'"),
      checkIn: z.string().describe("Check-in date YYYY-MM-DD"),
      checkOut: z.string().describe("Check-out date YYYY-MM-DD"),
      currency: z.string().optional().describe("Currency code, default USD"),
    }),
  }
);

// ─── 4. GOOGLE MAPS / LOCAL SEARCH ───────────────────────────────────────────

export const searchMapTool = tool(
  async ({ query }: { query: string }): Promise<string> => {
    const key = process.env.SERP_API_KEY;
    if (!key) return missingKey("Map search", "SERP_API_KEY");
    try {
      const params = new URLSearchParams({
        engine: "google_maps",
        type: "search",
        q: query,
        api_key: key,
        hl: "en",
      });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json() as Record<string, unknown>;
      const results = (data.local_results as unknown[] | undefined) ?? [];
      if (!results.length) return `No places found for "${query}".`;
      const top = (results as Record<string, unknown>[]).slice(0, 5).map((r) => ({
        name: r.title,
        rating: r.rating,
        reviewCount: r.reviews,
        address: r.address,
        type: r.type,
        openNow: (r.hours as Record<string, boolean> | undefined)?.currently_open ?? null,
        phone: r.phone,
      }));
      return JSON.stringify(top, null, 2);
    } catch (e) {
      return `Map search error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "search_map",
    description:
      "Find real places on Google Maps — restaurants, attractions, museums, cafes, etc.",
    schema: z.object({
      query: z.string().describe(
        "Search query, e.g. 'best restaurants in Kyoto' or 'Eiffel Tower Paris'"
      ),
    }),
  }
);

// ─── 5. CURRENCY EXCHANGER ───────────────────────────────────────────────────

export const currencyExchangerTool = tool(
  async ({
    amount,
    from,
    to,
  }: {
    amount: number;
    from: string;
    to: string;
  }): Promise<string> => {
    const key = process.env.EXCHANGE_RATE_API_KEY;
    if (!key) return missingKey("Currency conversion", "EXCHANGE_RATE_API_KEY");
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${key}/pair/${from.toUpperCase()}/${to.toUpperCase()}`
      );
      const data = await res.json() as Record<string, unknown>;
      if ((data as { result?: string }).result !== "success") {
        return `Currency error: ${(data as { "error-type"?: string })["error-type"] ?? "Unknown"}`;
      }
      const rate = data.conversion_rate as number;
      const converted = (amount * rate).toFixed(2);
      return `💱 ${amount} ${from.toUpperCase()} = ${converted} ${to.toUpperCase()} (rate: ${rate})`;
    } catch (e) {
      return `Currency error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "currency_exchanger",
    description: "Convert amounts between currencies with live exchange rates.",
    schema: z.object({
      amount: z.number().describe("Amount to convert"),
      from: z.string().describe("Source currency code, e.g. 'USD'"),
      to: z.string().describe("Target currency code, e.g. 'JPY'"),
    }),
  }
);

// ─── 6. WEB SEARCH ───────────────────────────────────────────────────────────

export const webSearchTool = tool(
  async ({ query }: { query: string }): Promise<string> => {
    const key = process.env.SERP_API_KEY;
    if (!key) return missingKey("Web search", "SERP_API_KEY");
    try {
      const params = new URLSearchParams({
        engine: "google",
        q: query,
        api_key: key,
        num: "6",
        hl: "en",
      });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await res.json() as Record<string, unknown>;
      const results = (data.organic_results as Record<string, string>[] | undefined) ?? [];
      if (!results.length) return "No results found.";
      return results
        .slice(0, 5)
        .map((r) => `• ${r.title}\n  ${r.snippet}`)
        .join("\n\n");
    } catch (e) {
      return `Search error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "web_search",
    description:
      "Search the web for travel tips, visa requirements, safety info, local customs, best seasons to visit, etc.",
    schema: z.object({
      query: z.string().describe("Search query"),
    }),
  }
);

// ─── 7. BOOKING TOOLS (truly agentic — the LLM decides to call these) ────────
//
// These are bound to a specific tripId at request time via makeBookingTools().
// When the agent calls one, it performs a REAL Prisma write through the same
// state-machine used by the manual "Book this trip" button — so whether the
// booking happens because the user clicked a button or because the agent
// decided autonomously to do it, the result is identical and equally real.

export function makeBookingTools(tripId: string) {
  const bookFlightTool = tool(
    async ({ airline, flightNumber, from, to, departTime, arriveTime, price, currency }) => {
      const { results } = await bookTrip({
        tripId,
        flight: { airline, flightNumber, from, to, departTime, arriveTime, price, currency },
      });
      const r = results[0];
      if (!r) return "Booking failed: no result returned.";
      return r.status === "CONFIRMED"
        ? `✅ Flight booked and confirmed. Reference: ${r.referenceId}. Price: ${currency ?? "USD"} ${r.price}.`
        : `❌ Flight booking failed: ${r.error ?? "unknown error"}. You may want to search again for an alternative.`;
    },
    {
      name: "book_flight",
      description:
        "Actually book a specific flight after the user has confirmed they want it. This performs a real reservation, not a suggestion. Only call this after explicit user confirmation.",
      schema: z.object({
        airline: z.string(),
        flightNumber: z.string().optional(),
        from: z.string(),
        to: z.string(),
        departTime: z.string().optional(),
        arriveTime: z.string().optional(),
        price: z.number(),
        currency: z.string().optional(),
      }),
    }
  );

  const bookHotelTool = tool(
    async ({ name, area, rating, pricePerNight, currency, nights }) => {
      const { results } = await bookTrip({
        tripId,
        hotel: { name, area, rating, pricePerNight, currency, nights },
      });
      const r = results[0];
      if (!r) return "Booking failed: no result returned.";
      return r.status === "CONFIRMED"
        ? `✅ Hotel booked and confirmed. Reference: ${r.referenceId}. Total: ${currency ?? "USD"} ${r.price}.`
        : `❌ Hotel booking failed: ${r.error ?? "unknown error"}. You may want to search again for an alternative.`;
    },
    {
      name: "book_hotel",
      description:
        "Actually book a specific hotel after the user has confirmed they want it. Performs a real reservation. Only call after explicit user confirmation.",
      schema: z.object({
        name: z.string(),
        area: z.string().optional(),
        rating: z.number().optional(),
        pricePerNight: z.number(),
        currency: z.string().optional(),
        nights: z.number().optional().describe("Number of nights to book"),
      }),
    }
  );

  const bookActivityTool = tool(
    async ({ name, category, price, currency }) => {
      const { results } = await bookTrip({
        tripId,
        activities: [{ name, category, price, currency }],
      });
      const r = results[0];
      if (!r) return "Booking failed: no result returned.";
      return r.status === "CONFIRMED"
        ? `✅ Activity booked and confirmed: ${name}. Reference: ${r.referenceId}.`
        : `❌ Activity booking failed: ${r.error ?? "unknown error"}.`;
    },
    {
      name: "book_activity",
      description:
        "Actually book a specific activity, tour, or experience after user confirmation. Performs a real reservation.",
      schema: z.object({
        name: z.string(),
        category: z.string().optional(),
        price: z.number(),
        currency: z.string().optional(),
      }),
    }
  );

  return [bookFlightTool, bookHotelTool, bookActivityTool];
}

// ─── Export all (search/info tools, always available) ────────────────────────

export const allTools = [
  weatherTool,
  searchFlightsTool,
  searchHotelsTool,
  searchMapTool,
  currencyExchangerTool,
  webSearchTool,
];
