# Staff Portal

A Next.js App Router frontend using React and Tailwind CSS. The [Seek Visual Artist repository](https://github.com/nuIIpointerexception/www.seekvisualartist.com/) informed the dark palette and typography. The dashboard uses its own layout and source.

## Run locally

Install Node.js 20.9 or newer, then run:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Every portal route redirects to Discord sign-in until OAuth, the staff guild, and at least one allowed role are configured. In local development, you can opt into inert sample data with `NEXT_PUBLIC_PORTAL_DEMO_MODE=true`; sign-in and the guild-role check remain required.

## Connect your backend

Copy `.env.example` to `.env.local` and configure Discord OAuth before starting the portal. The OAuth client secret, session secret, API base URL, and API shared secret are server-only values. The browser calls the same-origin `/api/portal/*` handlers; the handlers verify the signed Auth.js session and forward a trusted Discord staff identity to the backend.

## Configure Discord sign-in

1. Create an application in the Discord Developer Portal and add an OAuth2 redirect URL for each environment: `http://localhost:3000/api/auth/callback/discord` locally and `https://YOUR_PORTAL_HOST/api/auth/callback/discord` in production.
2. Set `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` from that application. Generate `AUTH_SECRET` with a cryptographically secure random value (for example, `openssl rand -base64 32`). Never commit `.env.local` or expose these values in `NEXT_PUBLIC_*` variables.
3. Set `DISCORD_GUILD_ID` and `DISCORD_ALLOWED_ROLE_IDS` (a comma-separated allowlist). A Discord account must be a member of that guild and hold at least one configured role. Set `DISCORD_ROLE_NAME_MAP` as semicolon-separated `role-id=Role Name` entries to show the matching role name in the sidebar. Missing auth configuration fails closed.
4. Use HTTPS in production. Auth.js uses OAuth state and PKCE checks, and its short-lived session cookie is encrypted, HttpOnly, SameSite, and Secure on HTTPS.

Only `identify` and `guilds.members.read` are requested. The Discord access token is used server-side to verify guild membership and roles; it is not exposed in the browser session.

## Connect the staff API

Set `PORTAL_API_BASE` to the backend origin or API prefix, and configure a high-entropy `PORTAL_API_SHARED_SECRET` in both this app and the backend gateway. Do not expose either value through a public environment variable. The app only proxies the documented allowlisted read/write routes. It forwards `X-Staff-Discord-ID`, `X-Staff-Discord-Name`, and `X-Staff-Discord-Roles` alongside the shared bearer credential. The backend must accept these identity headers only from this trusted gateway, validate the shared credential, independently authorize staff actions, and derive audit actors from the forwarded authenticated identity. Do not trust identity fields in request JSON.

The routes and payloads below are the API contract. Protect them at the backend too; the Next.js proxy and UI are not substitutes for authorization at the data/action service.

| Request | Expected contract |
| --- | --- |
| `GET /overview` | `{ games: [{ id, name, color? }], servers: [{ id, gameId, players, capacity, pingMs, uptimeSeconds? }] }`. Use the Roblox job ID for the server ID and `null` if ping is unavailable. Uptime is the age of the instance when the overview is fetched. Supply the five actual games here. |
| `GET /users/lookup?query=...` | `{ id, username, displayName, presence, gameId?, serverId?, joinUrl?, playtimeSeconds?, moderationHistory? }` or JSON `null` for no match. Use `in_game`, `online`, `offline`, or `unknown` for presence. Supply an HTTPS Roblox link for the exact joinable instance. Playtime is the total across community games. |
| `GET /audit` | Newest-first array of entries with `{ id, createdAt, actor: { discordId, displayName }, action, target: { scope?, gameId?, serverId?, userId?, entryId? }, details?, status }`. This endpoint requires staff audit access. |
| `POST /announcements` | `{ scope, message, gameId?, serverId? }`. Scope is `all`, `game`, or `server`. Single-server announcements include both IDs. |
| `POST /servers/actions` | `{ action, gameId, serverId }`. Use `restart` to replace the specified instance or `shutdown` to close it. The backend authorizes the staff member and verifies that the Roblox job ID belongs to the requested game. The overview refreshes after the command is accepted. |
| `POST /moderation` | `{ action, userId, reason }` with `warn`, `kick`, or `ban`. |
| `POST /moderation/history/remove` | `{ userId, entryId, reason }`. Remove the specified entry from the player's displayed history. The backend should verify entry ownership and removal permissions, and retain the audit record and any active penalty. |

Use string IDs throughout. Return a successful HTTP status for accepted writes, and optionally return `{ message }` for a failed request. The UI distinguishes acceptance from in-game delivery.

Each moderation history entry is `{ id, action, reason, moderator, createdAt, scope?, gameId?, gameName? }`, with an ISO timestamp for `createdAt`. Use `scope: "global"` for actions that appear under every game filter. For game-specific actions, provide a `gameId` matching the overview and optionally a `gameName` for games no longer listed. Older entries without scope or game information appear in the unfiltered history as Unknown game. Return an empty array for a player with no recorded actions. The profile reloads the player's record by ID after an accepted moderation request. Demo history updates for the current browser session and resets on a full page reload.

## Connect the Staff Registry

Set `NEXT_PUBLIC_STAFF_SHEET_URL` to an embeddable Google Sheets view URL only if the sheet itself is access-controlled. Because this is a browser iframe, the URL is public to signed-in staff and Google applies its own sharing permissions. For sensitive rosters, serve the data through the authenticated backend instead.

Leaves of Absence is a placeholder.


## Command audit logging

Record announcements, warns, kicks, bans, history removals, restarts, and shutdowns on the backend for every command attempt. Derive the actor’s Discord user ID from the authenticated gateway headers. Keep that stable ID alongside a display name snapshot and use server-generated timestamps. Do not trust actor fields supplied by the browser.

Use action names `announce`, `warn`, `kick`, `ban`, `remove_history`, `restart`, and `shutdown`. Use outcomes `accepted`, `completed`, `rejected`, or `failed`. Reserve `completed` for confirmed execution. Keep audit entries even when a moderation history record is removed. The demo records commands locally for the current page session.
