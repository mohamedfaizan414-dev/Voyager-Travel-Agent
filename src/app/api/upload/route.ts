import { NextRequest, NextResponse } from "next/server";
import { uploadImageBuffer } from "@/lib/cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const tripId = formData.get("tripId") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadImageBuffer(buffer);

    if (tripId) {
      await prisma.trip.update({ where: { id: tripId }, data: { coverImageUrl: url } });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload failed:", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
