"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Ban, CalendarDays, Check, CircleDot, Clipboard, Clock, Download, Gamepad2, Megaphone, MoreHorizontal, Power, RefreshCw, RotateCcw, Search, Server, ShieldAlert, Trash2, UserRoundX, Users, X } from "lucide-react";
import { api, demo, safeJoinUrl, sheetUrl } from "./api";
import { createPortal } from "react-dom";

const headings = {
  servers: ["Server overview", "Monitor active Roblox instances and broadcast announcements."],
  players: ["Player lookup", "Find a Roblox account, check its in-game status, and take moderation actions."],
  audit: ["Audit Log", "Review staff commands and their recorded outcomes."],
  registry: ["Staff Registry", "View the staff roster from Google Sheets."],
  loa: ["Leaves of Absence", "Leave requests are coming in a future release."],
};

const serverActionLabels = { restart: "Restart server", shutdown: "Shut down server" };
const moderationLabels = { warn: "Warning", kick: "Kick", ban: "Ban" };
const actionLabels = { warn: "Issue warning", kick: "Kick player", ban: "Ban player" };

function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unavailable";
  if (seconds < 60) return Math.floor(seconds) + "s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return hours ? hours + "h " + minutes + "m" : minutes + "m";
}

function shortTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function relativeAge(value, now) {
  if (!value || !now) return "Waiting for data";
  return `Updated ${ageText(value, now)}`;
}

function ageText(value, now) {
  const seconds = Math.max(0, Math.floor((now - value) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function Portal({ tab, playerId, initialGame, initialServer }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [clockNow, setClockNow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(initialGame ?? null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(undefined);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const activeSearch = useRef(null);
  const [action, setAction] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);
  const [copiedId, setCopiedId] = useState("");
  const [notice, setNotice] = useState("");
  const [historyError, setHistoryError] = useState("");
  const serverSearchRef = useRef(null);
  const playerSearchRef = useRef(null);
  const [recentLookups, setRecentLookups] = useState([]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("vicko-recent-lookups") || "[]"); setRecentLookups(Array.isArray(saved) ? saved.slice(0, 5) : []); } catch { setRecentLookups([]); }
  }, []);
  useEffect(() => {
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api.overview(controller.signal).then(value => {
      if (!controller.signal.aborted) { setData(value); setLastUpdated(Date.now()); }
    }).catch(error => {
      if (!controller.signal.aborted) setOverviewError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => () => activeSearch.current?.abort(), []);
  useEffect(() => {
    if (tab !== "players" || !playerId) return;
    const controller = new AbortController();
    activeSearch.current?.abort();
    activeSearch.current = controller;
    setQuery(playerId);
    setResult(undefined);
    setSearchError("");
    setSearching(true);
    api.lookup(playerId, controller.signal).then(user => {
      if (!controller.signal.aborted) {
        setResult(user);
        if (user) {
          const recent = { id: user.id, username: user.username, displayName: user.displayName || user.username, lookedUpAt: Date.now(), presence: user.presence ?? "unknown" };
          setRecentLookups(previous => {
            const next = [recent, ...previous.filter(item => item.id !== recent.id)].slice(0, 5);
            try { localStorage.setItem("vicko-recent-lookups", JSON.stringify(next)); } catch {}
            return next;
          });
        }
      }
    }).catch(error => {
      if (!controller.signal.aborted) setSearchError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setSearching(false);
    });
    return () => controller.abort();
  }, [tab, playerId]);
  useEffect(() => {
    function shortcuts(event) {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) return;
      if (event.key === "/") { event.preventDefault(); (tab === "servers" ? serverSearchRef : tab === "players" ? playerSearchRef : null)?.current?.focus(); }
      if (event.key.toLowerCase() === "r" && tab === "servers" && !loading) { event.preventDefault(); reload(); }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [tab, loading]);
  const games = data?.games ?? [];
  const servers = data?.servers ?? [];
  const current = games.find(item => item.id === game) ?? games[0];
  const visible = servers.filter(server => server.gameId === current?.id);
  const [serverQuery, setServerQuery] = useState(initialServer ?? "");
  const [serverFilter, setServerFilter] = useState("all");
  const [serverSort, setServerSort] = useState({ key: "players", direction: "desc" });
  const filteredServers = visible.filter(server => {
    const queryMatch = server.id.toLowerCase().includes(serverQuery.trim().toLowerCase());
    const filterMatch = serverFilter === "all" || (serverFilter === "high-ping" && Number.isFinite(server.pingMs) && server.pingMs > 200) || (serverFilter === "near-capacity" && server.capacity > 0 && server.players / server.capacity >= .8);
    return queryMatch && filterMatch;
  }).sort((a, b) => {
    const difference = (Number(a[serverSort.key]) || 0) - (Number(b[serverSort.key]) || 0);
    return serverSort.direction === "asc" ? difference : -difference;
  });
  function sortServers(key) {
    setServerSort(old => old.key === key ? { key, direction: old.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
  }
  const totalPlayers = servers.reduce((sum, server) => sum + server.players, 0);
  const totalCapacity = servers.reduce((sum, server) => sum + server.capacity, 0);
  const pings = servers.map(server => server.pingMs).filter(Number.isFinite);
  const averagePing = pings.length ? Math.round(pings.reduce((sum, ping) => sum + ping, 0) / pings.length) : null;
  const latency = averagePing === null ? "—" : averagePing + " ms";
  const profile = tab === "players" ? result : null;
  const [title, description] = profile
    ? [profile.displayName || profile.username, ""]
        : headings[tab];
  function reload() {
    setOverviewError("");
    setLoading(true);
    setRefresh(value => value + 1);
  }
  async function lookup(value) {
    const controller = new AbortController();
    activeSearch.current?.abort();
    activeSearch.current = controller;
    setQuery(value);
    setResult(undefined);
    setHistoryError("");
    setSearchError("");
    setSearching(true);
    try {
      const user = await api.lookup(value.trim(), controller.signal);
      if (!controller.signal.aborted) {
        setResult(user);
        if (user) {
          const recent = { id: user.id, username: user.username, displayName: user.displayName || user.username, lookedUpAt: Date.now() };
          recent.presence = user.presence ?? "unknown";
          setRecentLookups(previous => {
            const next = [recent, ...previous.filter(item => item.id !== recent.id)].slice(0, 5);
            try { localStorage.setItem("vicko-recent-lookups", JSON.stringify(next)); } catch {}
            return next;
          });
          router.push(`/players/${encodeURIComponent(user.id)}`);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error.message);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  async function completeAction(message) {
    const userId = action.user?.id;
    setNotice(message);
    setAction(null);
    if (action.type === "server") reload();
    if (!userId) return;
    setHistoryError("");
    try {
      const updated = await api.lookup(userId);
      if (!updated) throw new Error("Player unavailable");
      setResult(old => old?.id === userId ? updated : old);
    } catch {
      setHistoryError("Could not refresh moderation history. Search for the player again to retry.");
    }
  }
  async function copy(id) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(value => value === id ? "" : value), 1500);
    } catch {
      setNotice("Could not copy the ID. You can select it in the table.");
    }
  }
  return <>
      <div className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-10 lg:px-14 lg:py-11">
        <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>
          {tab === "servers" && <div className="server-toolbar"><span className="last-updated" role="status">{loading ? "Updating…" : relativeAge(lastUpdated, clockNow)}</span><div className="flex flex-wrap gap-2"><button className="button" disabled={loading} onClick={reload} title="Refresh (R)"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Refresh<kbd>R</kbd></button><button className="button primary" onClick={() => setAction({ type: "announce", scope: "all" })}><Megaphone size={17}/>Global announcement</button></div></div>}
          {profile && <button className="button" onClick={() => { setNotice(""); router.push("/players"); }}><Search size={16}/>Back to player lookup</button>}
        </div>
        {notice && <div className="notice" role="status"><Check size={17}/>{notice}<button className="icon-button ml-auto" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16}/></button></div>}
        {tab === "servers" && <>
          <div className="stats grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[[Server, "Active servers", servers.length], [Users, "Players online", totalPlayers], [Activity, "Average ping", latency]].map(([Icon, label, value]) => <section className="panel stat" key={label}><span><Icon size={16}/>{label}</span><strong>{data ? value : "—"}</strong>{label === "Active servers" ? <div className="stat-footer">Across {games.length} experiences</div> : label === "Players online" ? <div className="stat-capacity"><span>{totalPlayers} / {totalCapacity} player slots</span><meter value={totalPlayers} max={Math.max(totalCapacity, 1)} aria-label="Overall player capacity"/></div> : <div className="stat-footer"><i className={averagePing !== null && averagePing < 100 ? "status-dot healthy" : "status-dot"}/>{averagePing === null ? "Latency unavailable" : averagePing < 100 ? "Healthy latency" : "Elevated latency"}</div>}</section>)}
          </div>
          {overviewError && <p className="error" role="alert">{overviewError}</p>}
          <section className="game-section"><div className="experiences-heading"><h2>Experiences</h2><span>{games.length} total</span></div><div className="experiences-grid grid grid-cols-1 gap-2 min-[500px]:grid-cols-2 lg:grid-cols-3">
            {games.map(item => {
              const count = servers.filter(server => server.gameId === item.id);
              return <button key={item.id} aria-pressed={current?.id === item.id} className={`game${current?.id === item.id ? " active" : ""}${count.length === 0 ? " inactive" : ""}`} onClick={() => setGame(item.id)}>
                <span className="game-icon"><Gamepad2 size={18}/></span><span className="game-copy"><strong>{item.name}</strong><small>{count.length ? `${count.length} ${count.length === 1 ? "server" : "servers"} · ${count.reduce((sum, server) => sum + server.players, 0)} players` : "No active servers"}</small></span>{current?.id === item.id && <span className="viewing-marker"><Check size={12}/>Viewing</span>}
              </button>;
            })}
            {!games.length && <p className="muted">{loading ? "Loading experiences…" : "No experiences available."}</p>}
          </div></section>
          <section className="panel server-panel"><div className="section-head"><div><h2>{current?.name ?? "Servers"}</h2><p>{filteredServers.length} of {visible.length} active {visible.length === 1 ? "server" : "servers"}</p></div>{current && <button className="button" onClick={() => setAction({ type: "announce", scope: "game", gameId: current.id })}><Megaphone size={16}/>Announce to this experience</button>}</div>
            {!visible.length && !loading && <div className="empty-servers"><span className="empty-server-icon"><Server size={20}/></span><h3>No active instances running</h3><p>{current?.name ?? "This experience"} currently has no active servers.</p><button className="button" onClick={reload}><RefreshCw size={14}/>Refresh servers</button></div>}
            <div className="server-filters"><div className="server-search"><Search size={15}/><input ref={serverSearchRef} aria-label="Search server IDs" value={serverQuery} onChange={event => setServerQuery(event.target.value)} placeholder="Filter by server ID"/><kbd>/</kbd>{serverQuery && <button type="button" className="search-clear" aria-label="Clear server ID filter" title="Clear filter" onClick={() => { setServerQuery(""); serverSearchRef.current?.focus(); }}><X size={14}/></button>}</div><select aria-label="Filter servers" value={serverFilter} onChange={event => setServerFilter(event.target.value)}><option value="all">All servers</option><option value="high-ping">High ping (&gt;200 ms)</option><option value="near-capacity">Near capacity (75%+)</option></select></div>
            <div className="overflow-x-auto server-table-scroll" onScroll={event => event.currentTarget.querySelectorAll(".action-menu[open]").forEach(menu => { menu.open = false; })}><table><thead><tr><th>Roblox server ID</th><th><button className="sort-button" onClick={() => sortServers("players")}>Players {serverSort.key === "players" ? serverSort.direction === "asc" ? "↑" : "↓" : "↕"}</button></th><th><button className="sort-button" onClick={() => sortServers("pingMs")}>Ping {serverSort.key === "pingMs" ? serverSort.direction === "asc" ? "↑" : "↓" : "↕"}</button></th><th><button className="sort-button" onClick={() => sortServers("uptimeSeconds")}>Uptime {serverSort.key === "uptimeSeconds" ? serverSort.direction === "asc" ? "↑" : "↓" : "↕"}</button></th><th className="text-right">Actions</th></tr></thead><tbody>
              {filteredServers.map(server => <tr key={server.id}><td><div className="server-id-group"><code className="server-id" title={server.id}>{server.id.length > 22 ? `${server.id.slice(0, 8)}…${server.id.slice(-8)}` : server.id}</code><button className={`icon-button has-tooltip${copiedId === server.id ? " copied" : ""}`} data-tooltip={copiedId === server.id ? "Copied" : "Copy server ID"} title={copiedId === server.id ? "Copied" : "Copy server ID"} aria-label={copiedId === server.id ? "Server ID copied" : "Copy server ID " + server.id} onClick={() => copy(server.id)}>{copiedId === server.id ? <Check size={14}/> : <Clipboard size={14}/>}</button><button className="icon-button has-tooltip" data-tooltip="Inspect server" title="Inspect server" aria-label={"Inspect server " + server.id} onClick={() => setSelectedServer(server)}><CircleDot size={14}/></button></div></td>
                <td className="numeric-cell"><div className="flex items-center gap-2"><span>{server.players} / {server.capacity}</span><span className={`capacity-meter${server.capacity > 0 && server.players / server.capacity >= .9 ? " capacity-critical" : server.capacity > 0 && server.players / server.capacity >= .75 ? " capacity-warning" : ""}`} role="meter" aria-valuenow={server.players} aria-valuemin={0} aria-valuemax={server.capacity} aria-label={`Server capacity ${server.players} of ${server.capacity}; amber above 75 percent`}><span style={{ width: `${Math.min(100, server.capacity ? server.players / server.capacity * 100 : 0)}%` }}/></span></div></td>
                <td className="numeric-cell"><span title="Healthy under 100 ms · elevated 100–200 ms · poor over 200 ms" className={!Number.isFinite(server.pingMs) ? "muted" : server.pingMs < 100 ? "ping ping-good" : server.pingMs <= 200 ? "ping ping-warn" : "ping ping-bad"}>{Number.isFinite(server.pingMs) ? server.pingMs + " ms" : "—"}</span></td>
                <td>{duration(server.uptimeSeconds)}</td>
                <td><ServerRowActions server={server} onAction={setAction}/></td></tr>)}
              {!filteredServers.length && <tr><td colSpan={5} className="empty">{loading ? "Loading servers…" : visible.length ? "No servers match these filters." : "No active servers to display."}</td></tr>}
            </tbody></table></div>{filteredServers.length > 0 && <div className="server-table-footer"><span>Showing {filteredServers.length} of {visible.length} servers</span><span>Live instance view</span></div>}
          </section>
        </>}
        {tab === "players" && !profile && !playerId && <section className="panel content-panel">
          <form onSubmit={event => { event.preventDefault(); if (query.trim()) lookup(query); }}>
            <label htmlFor="player-query">Roblox username or user ID</label><div className="player-search-row"><span className="player-input-wrap"><input ref={playerSearchRef} id="player-query" className="min-w-0 flex-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by username or ID" required/><kbd>/</kbd></span><button className="button primary" disabled={searching || !query.trim()}><Search size={16}/>{searching ? "Searching…" : "Search"}</button></div>
          </form>
          {!profile && !result && <div className="lookup-welcome"><div className="lookup-welcome-icon"><Search size={20}/></div><div><strong>Find a player</strong><p>Search by Roblox username or user ID to review presence and moderation history.</p></div><div className="lookup-presets">{demo && <><button onClick={() => lookup("DemoBuilder")}>DemoBuilder</button><button onClick={() => lookup("100002")}>100002</button></>}</div></div>}
          <div className="recent-lookups"><div className="recent-heading"><h2>Recent lookups</h2>{recentLookups.length > 0 && <button onClick={() => { setRecentLookups([]); try { localStorage.removeItem("vicko-recent-lookups"); } catch {} }}>Clear all</button>}</div>{recentLookups.length ? <div className="recent-list">{recentLookups.map(item => <div key={item.id} className="recent-player-row"><button className="recent-player" onClick={() => lookup(item.id)} aria-label={`Open profile for ${item.username}`}><span className="recent-avatar">{(item.displayName || item.username || "?").slice(0, 1).toUpperCase()}</span><span className="recent-player-copy"><strong>{item.displayName}</strong><small>@{item.username} · {new Date(item.lookedUpAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span><span className={`recent-status ${item.presence === "in_game" ? "online" : ""}`}>{item.presence === "in_game" ? "In game" : item.presence === "online" ? "Online" : item.presence === "offline" ? "Offline" : ""}</span></button><button className="recent-remove" aria-label={`Remove ${item.username} from recent lookups`} title="Remove from recent lookups" onClick={() => setRecentLookups(previous => { const next = previous.filter(entry => entry.id !== item.id); try { localStorage.setItem("vicko-recent-lookups", JSON.stringify(next)); } catch {} return next; })}><X size={14}/></button></div>)}</div> : <p className="recent-empty">Profiles you search will appear here for quick access.</p>}</div>
          {searchError && <p role="alert" className="error">{searchError}</p>}
          {result === null && <p className="muted mt-5" role="status">No matching Roblox account found.</p>}
        </section>}
        {tab === "players" && playerId && !profile && <section className="panel content-panel" role="status">{searching ? "Loading player profile…" : <><h2>Player not found</h2><p className="muted mt-2">No Roblox account matches this ID.</p><button className="button mt-4" onClick={() => router.push("/players")}>Back to player lookup</button></>}</section>}
        {profile && <PlayerProfile key={profile.id} player={profile} games={games} historyError={historyError} onViewServer={serverId => {
          const params = new URLSearchParams({ experience: profile.gameId ?? "", server: serverId });
          router.push(`/servers?${params.toString()}`);
        }}
          onAction={kind => setAction({ type: "moderate", kind, user: profile })}
          onRemove={entry => setAction({ type: "remove", entry, user: profile })}/>}
        {tab === "audit" && <AuditLog games={games} clockNow={clockNow} onOpenTarget={target => {
          if (target.userId) router.push(`/players/${encodeURIComponent(target.userId)}`);
          else if (target.serverId) {
            const params = new URLSearchParams({ experience: target.gameId ?? "", server: target.serverId });
            router.push(`/servers?${params.toString()}`);
          }
        }}/>}
        {tab === "registry" && <section className="panel content-panel">{sheetUrl ? <><a className="text-link" href={sheetUrl} target="_blank" rel="noreferrer">Open in Google Sheets</a><iframe className="sheet" title="Staff Registry Google Sheet" src={sheetUrl}/></> : <><h2>Google Sheet setup</h2><p className="muted mt-2">Set the Staff Registry sheet URL to display your roster here.</p></>}</section>}
        {tab === "loa" && <section className="panel content-panel"><CalendarDays size={26} className="muted mb-3"/><h2>Coming soon</h2></section>}
      </div>
    {selectedServer && <ServerDetails server={selectedServer} game={games.find(item => item.id === selectedServer.gameId)} onClose={() => setSelectedServer(null)} onCopy={copy} copied={copiedId === selectedServer.id}/>}
    {action && <ActionDialog action={action} games={games} servers={servers} totalPlayers={totalPlayers} onClose={() => setAction(null)} onSuccess={completeAction}/>}
  </>;
}

function PlayerProfile({ player, games, historyError, onAction, onRemove, onViewServer }) {
  const [gameFilter, setGameFilter] = useState("");
  const inGame = player.presence === "in_game";
  const joinUrl = inGame ? safeJoinUrl(player.joinUrl) : null;
  const status = { in_game: "In game", offline: "Offline", online: "Online" }[player.presence] ?? "Status unavailable";
  const history = Array.isArray(player.moderationHistory)
    ? [...player.moderationHistory].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    : null;
  const filteredHistory = history?.filter(entry =>
    !gameFilter || entry.scope === "global" || entry.gameId === gameFilter
  );
  return <div className="grid gap-4">
    <section className="panel profile-identity-card"><div className="profile-identity"><span className="player-avatar">{(player.displayName || player.username || "?").slice(0, 1).toUpperCase()}</span><div className="player-identity-copy"><p>@{player.username} <span>·</span> Roblox ID <code>{player.id}</code></p></div><span className={`profile-status ${inGame ? "online" : ""}`}>{status}</span></div><div className="profile-actions">{Object.entries(actionLabels).map(([kind, label]) => <button key={kind} className={kind === "ban" ? "button danger" : "button"} disabled={kind === "kick" && !inGame} onClick={() => onAction(kind)}>{label}</button>)}</div></section>
    <div className="grid gap-3 md:grid-cols-2">
      <section className="panel content-panel">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2>Roblox presence</h2></div>
        {inGame && <div className="presence"><div>{games.find(item => item.id === player.gameId)?.name ?? player.gameId ?? "Current server"}{player.serverId && <code className="block mt-1">{player.serverId}</code>}</div><div className="flex flex-wrap gap-2">{player.serverId && <button className="button" onClick={() => onViewServer(player.serverId)}>View server</button>}{joinUrl ? <a className="button" href={joinUrl} target="_blank" rel="noreferrer">Join server</a> : <button className="button" disabled title="The API must supply a Roblox join link">Join server</button>}</div></div>}
      </section>
      <section className="panel content-panel"><h2 className="flex items-center gap-2"><Clock size={18}/>Total playtime</h2><p className="mt-2 text-2xl font-bold">{duration(player.playtimeSeconds)}</p><p className="muted mt-1">Across community games</p></section>
    </div>
    <section className="panel moderation-history"><div className="section-head">
      <h2>Moderation history</h2>
      <div className="flex flex-wrap items-center gap-2">
        <label className="!m-0" htmlFor="history-game">Filter by game</label>
        <select className="!w-auto max-w-full" id="history-game" value={gameFilter} onChange={event => setGameFilter(event.target.value)}>
          {games.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
        </select>
      </div>
    </div>
      {historyError && <p className="error mx-4" role="alert">{historyError}</p>}
      {filteredHistory?.length ? <div className="overflow-x-auto"><table><thead><tr><th>Action</th><th>Game</th><th>Reason</th><th>Moderator</th><th>Date</th><th className="text-right">Manage</th></tr></thead><tbody>
        {filteredHistory.map(entry => <tr key={entry.id}><td><span className={`history-badge history-${entry.action}`}>{moderationLabels[entry.action] ?? entry.action}</span></td><td>{entry.scope === "global" ? "Global" : games.find(game => game.id === entry.gameId)?.name ?? entry.gameName ?? "Unknown game"}</td><td className="min-w-48 whitespace-normal">{entry.reason || "—"}</td><td><span className="moderator-cell"><span className="moderator-avatar">{(entry.moderator || "?").slice(0,1).toUpperCase()}</span>{entry.moderator || "—"}</span></td><td><time dateTime={entry.createdAt} title={Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt).toLocaleString() : "Unavailable"}>{shortTimestamp(entry.createdAt)}</time></td><td className="text-right"><button className="icon-button has-tooltip history-remove" data-tooltip="Remove history entry" onClick={() => onRemove(entry)} aria-label={"Remove " + (moderationLabels[entry.action] ?? entry.action).toLowerCase() + " record"}><Trash2 size={15}/></button></td></tr>)}
      </tbody></table></div> : <p className="muted px-5 pb-5">{!history ? "Moderation history unavailable." : gameFilter && history.length ? "No moderation actions for this game." : "No moderation actions recorded."}</p>}
    </section>
  </div>;
}

function ActionDialog({ action, games, servers, totalPlayers, onClose, onSuccess }) {
  const ref = useRef(null);
  const [scope, setScope] = useState(action.scope ?? "all");
  const [gameId, setGameId] = useState(action.gameId ?? games[0]?.id ?? "");
  const [serverId, setServerId] = useState(action.serverId ?? "");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [guardrailChecked, setGuardrailChecked] = useState(false);
  const [error, setError] = useState("");
  const announcing = action.type === "announce";
  const removing = action.type === "remove";
  const managingServer = action.type === "server";
  const highImpact = (managingServer && action.kind === "shutdown") || (announcing && scope === "all") || removing || (!managingServer && !announcing && !removing && action.kind === "ban");
  const requiresContent = !managingServer;
  const impactedPlayers = managingServer ? action.server.players : announcing && scope === "all" ? totalPlayers : announcing && scope === "game" ? servers.filter(item => item.gameId === gameId).reduce((sum, item) => sum + item.players, 0) : announcing ? servers.find(item => item.id === serverId)?.players ?? 0 : 0;
  const impactedServers = managingServer ? 1 : announcing && scope === "all" ? servers.length : announcing && scope === "game" ? servers.filter(item => item.gameId === gameId).length : announcing ? Number(servers.some(item => item.id === serverId)) : 0;
  const title = managingServer ? serverActionLabels[action.kind] : removing ? "Remove history entry" : announcing ? "Send announcement" : actionLabels[action.kind];
  useEffect(() => { ref.current.showModal(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (pending || (requiresContent && !content.trim()) || (highImpact && !guardrailChecked)) return;
    setPending(true);
    setError("");
    try {
      if (managingServer) {
        await api.manageServer({ action: action.kind, gameId: action.server.gameId, serverId: action.server.id });
        onSuccess(demo
          ? action.kind === "restart" ? "Demo server restarted." : "Demo server shut down."
          : "Server command accepted. Refresh to check the latest server status.");
        return;
      }
      if (removing) {
        await api.removeHistory({ userId: action.user.id, entryId: action.entry.id, reason: content.trim() });
        onSuccess(demo ? "Demo history entry removed." : "History removal accepted by the API.");
        return;
      }
      if (announcing) {
        await api.announce({ scope, ...(scope !== "all" && { gameId }), ...(scope === "server" && { serverId }), message: content.trim() });
      } else {
        await api.moderate({ action: action.kind, userId: action.user.id, reason: content.trim() });
      }
      onSuccess(demo ? "Demo action completed. No Roblox request was sent." : announcing ? "Announcement accepted by the API." : "Moderation action accepted by the API.");
    } catch (failure) {
      setError(failure.message);
      setPending(false);
    }
  }
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
    <form onSubmit={submit}><div className="flex items-center justify-between gap-3"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Close" disabled={pending} onClick={onClose}><X size={21}/></button></div>
      {managingServer ? <div className="presence">
        <div className="min-w-0">
          <strong>{games.find(item => item.id === action.server.gameId)?.name ?? action.server.gameId}</strong>
          <code className="block">{action.server.id}</code>
          <p className="muted mt-2">{action.server.players} connected {action.server.players === 1 ? "player" : "players"}</p>
          <p className="mt-2">{action.kind === "restart"
            ? "Restarting replaces this server instance and can disconnect its players."
            : "Shutting down closes this server and disconnects its players."}</p>
        </div>
      </div> : announcing ? <><label htmlFor="scope">Audience</label><select id="scope" value={scope} onChange={event => { setScope(event.target.value); setGuardrailChecked(false); }} disabled={pending}><option value="all">All games</option><option value="game">One game</option><option value="server">One server</option></select>
        {scope !== "all" && <><label htmlFor="experience">Game</label><select id="experience" required value={gameId} onChange={event => { setGameId(event.target.value); setServerId(""); }} disabled={pending}><option value="">Select a game</option>{games.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></>}
        {scope === "server" && <><label htmlFor="instance">Server ID</label><select id="instance" required value={serverId} onChange={event => setServerId(event.target.value)} disabled={pending}><option value="">Select a server</option>{servers.filter(item => item.gameId === gameId).map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></>}
        <div className={highImpact ? "impact-summary high-impact" : "impact-summary"}><strong>{scope === "all" ? "Global audience" : scope === "game" ? games.find(item => item.id === gameId)?.name : "Selected server"}</strong><span>May reach {impactedPlayers} {impactedPlayers === 1 ? "player" : "players"} across {impactedServers} {impactedServers === 1 ? "server" : "servers"}</span></div>
      </> : <p className="muted mt-3">@{action.user.username} · {action.user.id}</p>}
      {removing && <div className="presence"><div><strong>{moderationLabels[action.entry.action] ?? action.entry.action}</strong><p className="muted">{action.entry.reason || "No reason recorded"}</p><p className="muted">This removes the history entry. Active penalties stay in effect.</p></div></div>}
      {!managingServer && <><label htmlFor="content">{removing ? "Reason for removal" : announcing ? "Message" : "Reason"}</label><textarea id="content" required={requiresContent} rows={4} value={content} onChange={event => setContent(event.target.value)} disabled={pending}/></>}
      {highImpact && <label className="confirm-check"><input type="checkbox" checked={guardrailChecked} onChange={event => setGuardrailChecked(event.target.checked)} disabled={pending}/><span>{managingServer ? `I understand this will shut down the server and disconnect ${impactedPlayers} ${impactedPlayers === 1 ? "player" : "players"}.` : removing ? `I understand this will permanently remove this ${moderationLabels[action.entry.action]?.toLowerCase() ?? "moderation"} history record.` : action.kind === "ban" ? `I understand this will ban @${action.user.username}${content.trim() ? ` for: ${content.trim()}` : ""}.` : `I understand this message will be sent to all experiences and may reach ${impactedPlayers} players across ${impactedServers} servers.`}</span></label>}
      {demo && <p className="muted mt-2">Demo mode. This action stays in the portal.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="flex justify-end gap-2 mt-5"><button type="button" className="button" disabled={pending} onClick={onClose}>Cancel</button><button className={managingServer || removing || action.kind === "ban" ? "button danger" : "button primary"} disabled={pending || (requiresContent && !content.trim()) || (highImpact && !guardrailChecked)}>{pending ? "Submitting…" : announcing && scope === "all" ? "Send global announcement" : title}</button></div>
    </form>
  </dialog>;
}

function ServerDetails({ server, game, onClose, onCopy, copied }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="server-drawer" aria-labelledby="server-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="drawer-heading"><div><p className="eyebrow">SERVER INSTANCE</p><h2 id="server-drawer-title">{game?.name ?? "Server details"}</h2></div><button className="icon-button" aria-label="Close server details" onClick={onClose}><X size={19}/></button></div>
    <code className="drawer-server-id">{server.id}</code>
    <div className="drawer-metrics"><div><span>Players</span><strong>{server.players} / {server.capacity}</strong></div><div><span>Ping</span><strong>{Number.isFinite(server.pingMs) ? `${server.pingMs} ms` : "Unavailable"}</strong></div><div><span>Uptime</span><strong>{duration(server.uptimeSeconds)}</strong></div></div>
    <p className="drawer-note">The connected player roster and server region aren’t included in the current overview API response.</p>
    <div className="flex flex-wrap justify-end gap-2 mt-5"><button className="button" onClick={() => onCopy(server.id)}>{copied ? <Check size={14}/> : <Clipboard size={14}/ >}{copied ? "Copied" : "Copy server ID"}</button><button className="button" onClick={onClose}>Close</button></div>
  </dialog>;
}

function ServerRowActions({ server, onAction }) {
  const detailsRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  function positionMenu(event) {
    const details = event.currentTarget;
    if (!details.open) { setMenuOpen(false); return; }
    const anchor = details.querySelector("summary")?.getBoundingClientRect();
    if (!anchor) return;
    const flipUp = window.innerHeight - anchor.bottom < 92;
    setMenuStyle({ position: "fixed", width: 188, right: Math.max(8, window.innerWidth - anchor.right), top: flipUp ? "auto" : anchor.bottom + 5, bottom: flipUp ? window.innerHeight - anchor.top + 5 : "auto" });
    setMenuOpen(true);
  }
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = event => {
      if (detailsRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (detailsRef.current) detailsRef.current.open = false;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", dismiss); window.removeEventListener("scroll", dismiss, true); };
  }, [menuOpen]);
  const menu = menuOpen && typeof document !== "undefined" ? createPortal(<div ref={menuRef} className="action-menu-popover action-menu-portal" style={menuStyle} role="menu">{Object.entries(serverActionLabels).map(([kind, label]) => <button key={kind} role="menuitem" className={kind === "shutdown" ? "menu-danger" : ""} onClick={() => { if (detailsRef.current) detailsRef.current.open = false; setMenuOpen(false); onAction({ type: "server", kind, server }); }}>{kind === "restart" ? <RotateCcw size={14}/> : <Power size={14}/ >}{label}</button>)}</div>, document.body) : null;
  return <div className="server-actions"><button className="button compact" aria-label={"Announce to server " + server.id} onClick={() => onAction({ type: "announce", scope: "server", gameId: server.gameId, serverId: server.id })}><Megaphone size={14}/>Announce</button>
    <details ref={detailsRef} className="action-menu" onToggle={positionMenu}><summary aria-label="More server actions" aria-haspopup="menu" aria-expanded={menuOpen} title="More actions"><MoreHorizontal size={17}/></summary></details>{menu}
  </div>;
}

const auditLabels = {
  ...moderationLabels, ...serverActionLabels, announce: "Announcement", remove_history: "Remove history entry",
};
const auditStatuses = { completed: "Completed", accepted: "Accepted", rejected: "Rejected", failed: "Failed" };

function staffInitials(name = "?") {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
}

function staffHue(name = "") {
  return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

function AuditLog({ games, clockNow, onOpenTarget }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [lastAuditUpdate, setLastAuditUpdate] = useState(null);
  const auditSearchRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    api.audit(controller.signal).then(value => {
      if (!controller.signal.aborted) { setEntries(value); setLastAuditUpdate(Date.now()); }
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    function shortcuts(event) {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) return;
      if (event.key === "/") { event.preventDefault(); auditSearchRef.current?.focus(); }
      if (event.key.toLowerCase() === "r") { event.preventDefault(); setEntries(null); setError(""); setRefresh(value => value + 1); }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);
  useEffect(() => { setPageSize(50); }, [query, actionFilter, outcomeFilter, staffFilter, dateFrom, dateTo]);

  const staffNames = [...new Set((entries ?? []).map(entry => entry.actor?.displayName || entry.actor?.discordId || "Unknown staff member"))].sort();
  const visibleEntries = (entries ?? []).filter(entry => {
    const action = entry.action;
    const category = action === "announce" ? "announcement" : ["restart", "shutdown"].includes(action) ? "server" : "moderation";
    const status = ["completed", "accepted"].includes(entry.status) ? "succeeded" : ["failed", "rejected"].includes(entry.status) ? "failed" : entry.status;
    const textMatch = !query.trim() || JSON.stringify(entry).toLowerCase().includes(query.trim().toLowerCase());
    const staffName = entry.actor?.displayName || entry.actor?.discordId || "Unknown staff member";
    const date = Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt).toISOString().slice(0, 10) : "";
    return (actionFilter === "all" || category === actionFilter) && (outcomeFilter === "all" || status === outcomeFilter) && (staffFilter === "all" || staffName === staffFilter) && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo) && textMatch;
  });
  const paginatedEntries = visibleEntries.slice(0, pageSize);
  function refreshLog() { setEntries(null); setError(""); setRefresh(value => value + 1); }
  function exportCsv() {
    const columns = ["Timestamp", "Staff", "Staff ID", "Action", "Target", "Details", "Outcome"];
    const lines = [columns, ...visibleEntries.map(entry => [entry.createdAt, entry.actor?.displayName || "Unknown staff member", entry.actor?.discordId || "", auditLabels[entry.action] ?? entry.action, entry.target?.serverId || entry.target?.userId || entry.target?.gameId || entry.target?.scope || "", entry.details || "", auditStatuses[entry.status] ?? entry.status])];
    const csv = lines.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `vicko-audit-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function resetFilters() { setQuery(""); setActionFilter("all"); setOutcomeFilter("all"); setStaffFilter("all"); setDateFrom(""); setDateTo(""); }

  return <section className="panel">
    <div className="section-head audit-heading">
      <div><h2>Command history</h2><p><strong className="audit-count">{visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}</strong><span>{demo ? " · Sample entries reset when you reload the page." : " · Commands are recorded by the staff backend."}</span></p></div>
      <div className="audit-heading-actions"><span className="last-updated" role="status">{entries === null ? "Updating…" : relativeAge(lastAuditUpdate, clockNow)}</span><button className="button" disabled={entries === null} onClick={refreshLog}><RefreshCw size={16} className={entries === null ? "animate-spin" : ""}/>Refresh<kbd>R</kbd></button><button className="button" disabled={!visibleEntries.length} onClick={exportCsv}><Download size={15}/>Export CSV</button></div>
    </div>
    <div className="audit-toolbar"><div className="audit-search"><Search size={15}/><input ref={auditSearchRef} aria-label="Search audit log" placeholder="Search staff, target, or details" value={query} onChange={event => setQuery(event.target.value)}/><kbd>/</kbd>{query && <button type="button" className="search-clear" aria-label="Clear audit search" title="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}</div><select aria-label="Filter audit actions" value={actionFilter} onChange={event => setActionFilter(event.target.value)}><option value="all">All actions</option><option value="announcement">Announcements</option><option value="server">Server control</option><option value="moderation">Moderation</option></select><select aria-label="Filter audit outcomes" value={outcomeFilter} onChange={event => setOutcomeFilter(event.target.value)}><option value="all">All outcomes</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option></select><select aria-label="Filter by staff member" value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="all">All staff</option>{staffNames.map(name => <option key={name} value={name}>{name}</option>)}</select><label className="audit-date-label">From<input aria-label="Audit start date" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)}/></label><label className="audit-date-label">To<input aria-label="Audit end date" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)}/></label><button className="audit-reset" onClick={resetFilters}>Reset filters</button></div>
    {error ? <p className="error mx-4" role="alert">{error}</p> : entries !== null ? (
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Time</th><th>Staff member</th><th>Action</th><th>Target</th><th>Details / reason</th><th>Outcome</th></tr></thead>
          <tbody>{paginatedEntries.map(entry => {
            const target = entry.target ?? {};
            const game = games.find(item => item.id === target.gameId)?.name ?? target.gameId;
            const actionClass = entry.action === "announce" ? "announcement" : entry.action === "restart" ? "restart" : entry.action === "shutdown" ? "shutdown" : entry.action === "ban" ? "ban" : entry.action === "warn" ? "warning" : entry.action === "kick" ? "kick" : "neutral";
            const ActionIcon = entry.action === "announce" ? Megaphone : entry.action === "restart" ? RotateCcw : entry.action === "shutdown" ? Power : entry.action === "ban" ? Ban : entry.action === "warn" ? AlertTriangle : entry.action === "kick" ? UserRoundX : ShieldAlert;
            const successful = ["completed", "accepted"].includes(entry.status);
            const failed = ["failed", "rejected"].includes(entry.status);
            const exactTime = Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt) : null;
            const staffName = entry.actor?.displayName || entry.actor?.discordId || "Unknown staff member";
            const staffIdHue = staffHue(staffName);
            const payload = entry.payload ?? { target, details: entry.details, status: entry.status };
            return <tr key={entry.id} className={failed ? "audit-row-failed" : ""}>
              <td><time dateTime={entry.createdAt} title={exactTime?.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "Timestamp unavailable"}>{exactTime ? ageText(exactTime.getTime(), clockNow ?? Date.now()) : "—"}</time></td>
              <td><span className="audit-staff"><span className="moderator-avatar audit-avatar" style={{ "--staff-hue": staffIdHue }}>{staffInitials(staffName)}</span><span className="audit-staff-copy"><strong>{staffName}</strong>{entry.actor?.discordId && <code>{entry.actor.discordId}</code>}</span></span></td>
              <td><span className={`audit-action audit-action-${actionClass}`}><ActionIcon size={13}/>{auditLabels[entry.action] ?? entry.action}</span></td>
              <td>{target.serverId ? <><button className="audit-target-link" title={target.serverId} onClick={() => onOpenTarget(target)}>{target.serverId.length > 22 ? `${target.serverId.slice(0, 8)}…${target.serverId.slice(-8)}` : target.serverId}</button>{game && <small className="audit-target-context">{game}</small>}</> : target.userId ? <button className="audit-target-link" onClick={() => onOpenTarget(target)}>Roblox user {target.userId}</button> : target.scope === "all" ? "All experiences" : game || "—"}
                {target.entryId && <code className="block">Record {target.entryId}</code>}
              </td>
              <td className="audit-detail-cell">{entry.details || "—"}{failed && <details className="audit-payload"><summary>Inspect failed request</summary><pre>{JSON.stringify(payload, null, 2)}</pre>{entry.error && <p>{entry.error}</p>}</details>}</td>
              <td><span className={`audit-outcome ${successful ? "success" : failed ? "failure" : "pending"}`}>{successful ? "Success" : failed ? "Failed" : auditStatuses[entry.status] ?? entry.status}</span></td>
            </tr>;
          })}{!visibleEntries.length && <tr><td colSpan={6} className="empty">No audit entries match these filters.</td></tr>}</tbody>
        </table>
        {visibleEntries.length > pageSize && <div className="audit-load-more"><span>Showing {paginatedEntries.length} of {visibleEntries.length} entries</span><button className="button" onClick={() => setPageSize(size => size + 50)}>Load more</button></div>}
      </div>
    ) : <p className="muted px-5 pb-5" role="status">Loading audit log…</p>}
  </section>;
}
