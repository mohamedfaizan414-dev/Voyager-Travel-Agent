import * as fs from "fs";
import * as path from "path";

// Manually load .env before anything else (Prisma 7 scripts don't auto-read it)
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const demoEmail = "demo@voyager.ai";
  const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash("voyager123", 10);
    const user = await prisma.user.create({
      data: { name: "Demo Traveller", email: demoEmail, password: hashed },
    });
    console.log("✅ Demo user created:", user.email, "(password: voyager123)");
  } else {
    console.log("ℹ️  Demo user already exists:", demoEmail);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
