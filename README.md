# Staff Portal

A Next.js App Router frontend using React and Tailwind CSS. The [Seek Visual Artist repository](https://github.com/nuIIpointerexception/www.seekvisualartist.com/) informed the dark palette and typography. The dashboard uses its own layout and source.

## Run locally

Install Node.js 20.9 or newer, then run:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. With no API configured, the portal shows five configured experiences and mock server data. Search for `DemoBuilder` (in-game) or `100002` (offline). Demo announcements and moderation requests only show local confirmation. The sample account has no real server join link.

## Connect your backend

Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_PORTAL_API_BASE` to the existing API's base URL or a same-origin path such as `/api/staff`. These values are public at build time. Keep service credentials in your existing authenticated backend or server-side gateway.

The routes and payloads below are a proposed interface. Map them to your actual API and authentication in `app/api.js`. The current client uses cookie credentials. Same-origin routing is simplest. For cross-origin cookie auth, configure the API to accept credentialed requests from the portal origin. The backend must enforce staff permissions and protect state-changing requests against CSRF before connecting live controls.

| Request | Expected contract |
| --- | --- |
| `GET /overview` | `{ games: [{ id, name, color? }], servers: [{ id, gameId, players, capacity, pingMs, uptimeSeconds? }] }`. Use the Roblox job ID for the server ID and `null` if ping is unavailable. Uptime is the age of the instance when the overview is fetched. Supply the five actual games here. |
| `GET /users/lookup?query=...` | `{ id, username, displayName, presence, gameId?, serverId?, joinUrl?, playtimeSeconds?, moderationHistory? }` or JSON `null` for no match. Use `in_game`, `online`, `offline`, or `unknown` for presence. Supply an HTTPS Roblox link for the exact joinable instance. Playtime is the total across community games. |
| `POST /announcements` | `{ scope, message, gameId?, serverId? }`. Scope is `all`, `game`, or `server`. Single-server announcements include both IDs. |
| `POST /moderation` | `{ action, userId, reason }` with `warn`, `kick`, or `ban`. |
| `POST /moderation/history/remove` | `{ userId, entryId, reason }`. Remove the specified entry from the player's displayed history. The backend should verify entry ownership and removal permissions, and retain the audit record and any active penalty. |

Use string IDs throughout. Return a successful HTTP status for accepted writes, and optionally return `{ message }` for a failed request. The UI distinguishes acceptance from in-game delivery.

Each moderation history entry is `{ id, action, reason, moderator, createdAt, scope?, gameId?, gameName? }`, with an ISO timestamp for `createdAt`. Use `scope: "global"` for actions that appear under every game filter. For game-specific actions, provide a `gameId` matching the overview and optionally a `gameName` for games no longer listed. Older entries without scope or game information appear in the unfiltered history as Unknown game. Return an empty array for a player with no recorded actions. The profile reloads the player's record by ID after an accepted moderation request. Demo history updates for the current browser session and resets on a full page reload.

## Connect the Staff Registry

Set `NEXT_PUBLIC_STAFF_SHEET_URL` to your embeddable Google Sheets view URL, for example `https://docs.google.com/spreadsheets/d/SHEET_ID/preview?gid=0`. Test with a staff account. Access depends on the sheet's sharing permissions and Google sign-in in the browser. Keep staff-only roster data behind your existing access controls.

Leaves of Absence is a placeholder.

