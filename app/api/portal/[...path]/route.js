import { auth } from "../../../../auth";

const allowedRequests = [
  { method: "GET", path: /^overview$/ },
  { method: "GET", path: /^audit$/ },
  { method: "GET", path: /^users\/lookup$/ },
  { method: "POST", path: /^announcements$/ },
  { method: "POST", path: /^servers\/actions$/ },
  { method: "POST", path: /^moderation$/ },
  { method: "POST", path: /^moderation\/history\/remove$/ },
];

function jsonError(status, message) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeHeader(value, maxLength = 100) {
  return String(value ?? "").replace(/[\r\n\0]/g, " ").slice(0, maxLength);
}

async function proxyRequest(request, { params }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.staffAuthorized || !user.discordId) return jsonError(401, "Staff sign-in required.");

  const { path = [] } = await params;
  if (!path.every(part => /^[a-zA-Z0-9_-]+$/.test(part))) return jsonError(404, "Not found.");
  const route = path.join("/");
  if (!allowedRequests.some(item => item.method === request.method && item.path.test(route))) return jsonError(404, "Not found.");

  const base = process.env.PORTAL_API_BASE?.trim();
  const sharedSecret = process.env.PORTAL_API_SHARED_SECRET?.trim();
  if (!base || (sharedSecret?.length ?? 0) < 32) return jsonError(503, "The staff API is not configured.");

  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return jsonError(403, "Cross-origin request rejected.");
  }

  let target;
  try {
    if (!base.startsWith("/") && !/^https?:\/\//i.test(base)) return jsonError(503, "The staff API configuration is invalid.");
    target = new URL(base, request.url);
    if (!/^https?:$/.test(target.protocol) || target.username || target.password || target.hash) return jsonError(503, "The staff API configuration is invalid.");
    if (process.env.NODE_ENV === "production" && target.protocol !== "https:") return jsonError(503, "The staff API must use HTTPS.");
    const prefix = target.pathname.replace(/\/+$/, "");
    target.pathname = `${prefix}/${path.map(encodeURIComponent).join("/")}`;
    target.search = new URL(request.url).search;
  } catch {
    return jsonError(503, "The staff API configuration is invalid.");
  }

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${sharedSecret}`,
    "X-Staff-Discord-ID": user.discordId,
    "X-Staff-Discord-Name": safeHeader(user.name ?? "Staff member"),
    "X-Staff-Discord-Roles": (user.discordRoles ?? []).join(","),
  });
  let body;
  if (request.method !== "GET") {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) return jsonError(415, "JSON requests only.");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) return jsonError(413, "Request body is too large.");
    try { JSON.parse(rawBody); } catch { return jsonError(400, "Invalid JSON request."); }
    headers.set("Content-Type", "application/json");
    body = rawBody;
  }

  try {
    const upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const responseType = upstream.headers.get("content-type");
    if (responseType) responseHeaders.set("Content-Type", responseType);
    const body = upstream.status === 204 || upstream.status === 304 ? null : upstream.body;
    return new Response(body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "The staff API could not be reached.");
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
