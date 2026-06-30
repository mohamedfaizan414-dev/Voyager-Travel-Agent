import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export const GUEST_TOKEN_COOKIE = "voyager_guest_token";
export const GUEST_FREE_RUNS = Number(process.env.GUEST_FREE_RUNS || 3);

/** Reads (or creates) the anonymous guest token stored in a cookie. */
export async function getOrCreateGuestToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_TOKEN_COOKIE)?.value;
  if (existing) return existing;
  const token = randomUUID();
  store.set(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return token;
}

export async function getGuestRunCount(guestToken: string): Promise<number> {
  const usage = await prisma.guestUsage.findUnique({ where: { guestToken } });
  return usage?.runCount ?? 0;
}

export async function incrementGuestRunCount(guestToken: string): Promise<number> {
  const usage = await prisma.guestUsage.upsert({
    where: { guestToken },
    update: { runCount: { increment: 1 }, lastUsedAt: new Date() },
    create: { guestToken, runCount: 1 },
  });
  return usage.runCount;
}

export function guestRunsRemaining(used: number): number {
  return Math.max(0, GUEST_FREE_RUNS - used);
}
