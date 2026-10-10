import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { validatePersistedRequest } from "@/lib/api-validation";
import { InputError, isPlainObject, isSameOriginMutation, readJsonBody } from "@/lib/request-security";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view saved requests." }, { status: 401 });
  const rate = await checkRateLimit(`saved-read:${user.id}`, 120, 60_000);
  if (!rate.available) return NextResponse.json({ error: "Request protection is temporarily unavailable. Try again shortly." }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before refreshing saved requests again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const requests = await getDb().savedRequest.findMany({ where: { userId: user.id }, include: { collection: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 500 });
  return NextResponse.json({ requests: requests.map(({ collection, ...item }) => ({ ...item, collection: collection?.name ?? "My requests" })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "This request must come from Manpost." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save requests." }, { status: 401 });
  const rate = await checkRateLimit(`saved-write:${user.id}`, 30, 60_000);
  if (!rate.available) return NextResponse.json({ error: "Request protection is temporarily unavailable. Try again shortly." }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: "Requests are being saved too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  try {
    const payload = await readJsonBody(request);
    if (!isPlainObject(payload)) throw new InputError("Request details must be a JSON object.");
    const input = validatePersistedRequest(payload);
    const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 120) : `${input.method} request`;
    const db = getDb();
    const collection = await db.collection.upsert({ where: { userId_name: { userId: user.id, name: "My requests" } }, create: { userId: user.id, name: "My requests" }, update: {} });
    const saved = await db.savedRequest.create({ data: { ...input, name: name || `${input.method} request`, userId: user.id, collectionId: collection.id } });
    return NextResponse.json({ request: { ...saved, collection: collection.name } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "We could not save this request." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "This request must come from Manpost." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage saved requests." }, { status: 401 });
  const rate = await checkRateLimit(`saved-write:${user.id}`, 30, 60_000);
  if (!rate.available) return NextResponse.json({ error: "Request protection is temporarily unavailable. Try again shortly." }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: "Requests are being changed too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 64) return NextResponse.json({ error: "A valid request ID is required." }, { status: 400 });
  const result = await getDb().savedRequest.deleteMany({ where: { id, userId: user.id } });
  if (!result.count) return NextResponse.json({ error: "Saved request not found." }, { status: 404 });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
