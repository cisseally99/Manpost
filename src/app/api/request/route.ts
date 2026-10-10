import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginMutation, InputError, readJsonBody, resolvePublicTarget, sendBoundedRequest, validateOutboundInput } from "@/lib/request-security";
import { checkClientRateLimit, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "This request must come from Manpost." }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to send requests." }, { status: 401 });

  const clientRate = await checkClientRateLimit(request.headers, 60, 60_000);
  if (!clientRate.available) return NextResponse.json({ error: "Request protection is temporarily unavailable. Try again shortly." }, { status: 503 });
  if (!clientRate.allowed) return NextResponse.json({ error: "Requests from this connection are being sent too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(clientRate.retryAfterSeconds) } });
  const rate = await checkRateLimit(`outbound:${user.id}`, 30, 60_000);
  if (!rate.available) return NextResponse.json({ error: "Request protection is temporarily unavailable. Try again shortly." }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: "You’re sending requests too quickly. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  try {
    const payload = await readJsonBody(request);
    const input = validateOutboundInput(payload);
    for (const [key, value] of Object.entries(input.query)) input.url.searchParams.set(key, value);

    const addresses = await resolvePublicTarget(input.url);
    const startedAt = performance.now();
    const upstream = await sendBoundedRequest(input, addresses);

    return NextResponse.json({
      status: upstream.status,
      statusText: upstream.statusText,
      responseTimeMs: Math.round(performance.now() - startedAt),
      headers: upstream.headers,
      body: upstream.body,
      bodyTruncated: upstream.bodyTruncated,
      contentType: upstream.contentType,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error && error.message.includes("too long")
      ? "The destination took too long to respond."
      : "We could not send this request. Check the URL, connection, and headers, then try again.";
    const status = message.includes("too long") ? 504 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
