import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { validateHistoryMetadata, validatePersistedRequest } from "@/lib/api-validation";
import { InputError, isPlainObject, isSameOriginMutation, readJsonBody } from "@/lib/request-security";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view request history." }, { status: 401 });
  const rate = takeRateLimit(`history-read:${user.id}`, 120, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before refreshing history again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const history = await getDb().requestHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "This request must come from Manpost." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save request history." }, { status: 401 });
  const rate = takeRateLimit(`history-write:${user.id}`, 60, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "History is being updated too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  try {
    const payload = await readJsonBody(request);
    if (!isPlainObject(payload)) throw new InputError("History details must be a JSON object.");
    const input = validatePersistedRequest(payload);
    const { status, responseTimeMs } = validateHistoryMetadata(payload);
    const item = await getDb().requestHistory.create({ data: { userId: user.id, ...input, status, responseTimeMs } });
    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "We could not save this history entry." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "This request must come from Manpost." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to clear request history." }, { status: 401 });
  const rate = takeRateLimit(`history-write:${user.id}`, 60, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "History is being updated too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  await getDb().requestHistory.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
