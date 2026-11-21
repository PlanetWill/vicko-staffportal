const base = process.env.NEXT_PUBLIC_PORTAL_API_BASE?.trim().replace(/\/$/, "");
export const demo = !base;
export const sheetUrl = process.env.NEXT_PUBLIC_STAFF_SHEET_URL;
const games = [
  ["emergency-usa", "Emergency USA: California", "violet"],
  ["emergency-london", "Emergency London: Camden", "blue"],
  ["patrol-london", "Patrol London: UKRP Callouts", "pink"],
  ["staffordshire", "Staffordshire, West Midlands", "green"],
  ["california-whitelisted", "California City, Whitelisted", "blue"],
].map(([id, name, color]) => ({ id, name, color }));
let servers = [
  ["staffordshire", "c73962af-4172-4f68-9d24-51de763eb463", 16, 40, 66, 11220],
  ["emergency-usa", "68be94fc-a6a0-4b26-9bb7-1a69eb2de052", 32, 40, 48, 18720],
  ["emergency-usa", "2cf79f60-97ed-47c0-871b-64f427578b31", 24, 40, 61, 9840],
  ["emergency-usa", "74ab9e51-5aed-4831-bf8b-70c463d81172", 18, 40, 73, 2820],
  ["emergency-london", "5d518fe0-13c9-4898-b28b-235fa6392470", 12, 30, 56, 7560],
  ["patrol-london", "89f96e2c-3373-42ae-993d-bd684d7ee1dd", 8, 50, 92, 38940],
].map(([gameId, id, players, capacity, pingMs, uptimeSeconds]) => ({ gameId, id, players, capacity, pingMs, uptimeSeconds }));
const users = [
  {
    id: "100001", username: "DemoBuilder", displayName: "Demo Builder", presence: "in_game",
    gameId: "emergency-usa", serverId: "68be94fc-a6a0-4b26-9bb7-1a69eb2de052", playtimeSeconds: 173040,
    moderationHistory: [
      { id: "demo-kick", action: "kick", scope: "global", reason: "Repeated disruption after a warning.", moderator: "Demo Moderator", createdAt: "2026-11-19T20:18:00Z" },
      { id: "demo-warning", action: "warn", gameId: "patrol-london", reason: "Disruptive chat during an event.", moderator: "Demo Moderator", createdAt: "2026-11-19T20:05:00Z" },
    ],
  },
  { id: "100002", username: "DemoScout", displayName: "Demo Scout", presence: "offline", playtimeSeconds: 44880, moderationHistory: [] },
];
const demoActions = new Map();
const removedDemoActions = new Map();
async function request(path, payload, signal) {
  const response = await fetch(base + path, {
    credentials: "include", cache: "no-store", signal,
    ...(payload && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === "string" ? body.message : `Request failed (${response.status}).`);
  }
  if (payload) return;
  return response.json();
}
export const api = {
  overview: (signal) => demo ? Promise.resolve({ games, servers }) : request("/overview", null, signal),
  async lookup(query, signal) {
    if (!demo) return request("/users/lookup?" + new URLSearchParams({ query }), null, signal);
    const user = users.find(item => [item.id, item.username.toLowerCase()].includes(query.toLowerCase()));
    if (!user) return null;
    const removed = removedDemoActions.get(user.id);
    const history = [...(demoActions.get(user.id) ?? []), ...user.moderationHistory];
    const serverEnded = user.serverId && !servers.some(server => server.id === user.serverId);
    return {
      ...user,
      ...(serverEnded && { presence: "offline", gameId: undefined, serverId: undefined }),
      moderationHistory: history.filter(entry => !removed?.has(entry.id)),
    };
  },
  async manageServer(payload) {
    if (!demo) return request("/servers/actions", payload);
    const { action, gameId, serverId } = payload;
    const index = servers.findIndex(server => server.id === serverId && server.gameId === gameId);
    if (index < 0) throw new Error("This server is no longer active. Refresh the server list.");
    if (action === "shutdown") {
      servers = servers.filter((_, position) => position !== index);
      return;
    }
    if (action !== "restart") throw new Error("Unknown server action.");
    servers = servers.map((server, position) => position === index
      ? { ...server, id: crypto.randomUUID(), players: 0, uptimeSeconds: 0, pingMs: null }
      : server);
  },
  announce: (payload) => demo ? Promise.resolve() : request("/announcements", payload),
  async moderate(payload) {
    if (!demo) return request("/moderation", payload);
    const { userId, action, reason } = payload;
    const entry = { id: crypto.randomUUID(), action, scope: "global", reason, moderator: "Demo staff", createdAt: new Date().toISOString() };
    demoActions.set(userId, [entry, ...(demoActions.get(userId) ?? [])]);
  },
  async removeHistory(payload) {
    if (!demo) return request("/moderation/history/remove", payload);
    const { userId, entryId } = payload;
    const removed = removedDemoActions.get(userId) ?? new Set();
    removed.add(entryId);
    removedDemoActions.set(userId, removed);
  },
};
export function safeJoinUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["www.roblox.com", "roblox.com"].includes(url.hostname)) return url.href;
  } catch {}
  return null;
}
