"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, CalendarDays, Check, Clipboard, Clock, Gamepad2, Megaphone, RefreshCw, Search, Server, Shield, Users, X } from "lucide-react";
import { api, demo, safeJoinUrl, sheetUrl } from "./api";

const tabs = [
  ["servers", "Servers", Server], ["players", "Player lookup", Search],
  ["registry", "Staff Registry", Users], ["loa", "Leaves of Absence", CalendarDays],
];
const headings = {
  servers: ["Server overview", "Monitor active Roblox instances and broadcast announcements."],
  players: ["Player lookup", "Find a Roblox account, check its in-game status, and take moderation actions."],
  registry: ["Staff Registry", "View the staff roster from Google Sheets."],
  loa: ["Leaves of Absence", "Leave requests are coming in a future release."],
};

const moderationLabels = { warn: "Warning", kick: "Kick", ban: "Ban" };
const actionLabels = { warn: "Issue warning", kick: "Kick player", ban: "Ban player" };

function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unavailable";
  if (seconds < 60) return Math.floor(seconds) + "s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return hours ? hours + "h " + minutes + "m" : minutes + "m";
}

export default function Portal() {
  const [tab, setTab] = useState("servers");
  const [data, setData] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(undefined);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const activeSearch = useRef(null);
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState("");
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api.overview(controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(error => {
      if (!controller.signal.aborted) setOverviewError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => () => activeSearch.current?.abort(), []);
  const games = data?.games ?? [];
  const servers = data?.servers ?? [];
  const current = games.find(item => item.id === game) ?? games[0];
  const visible = servers.filter(server => server.gameId === current?.id);
  const totalPlayers = servers.reduce((sum, server) => sum + server.players, 0);
  const pings = servers.map(server => server.pingMs).filter(Number.isFinite);
  const latency = pings.length ? Math.round(pings.reduce((sum, ping) => sum + ping, 0) / pings.length) + " ms" : "—";
  const profile = tab === "players" ? result : null;
  const [title, description] = profile
    ? [profile.displayName || profile.username, "@" + profile.username + " · Roblox ID " + profile.id]
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
      if (!controller.signal.aborted) setResult(user);
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
      setNotice("Server ID copied.");
    } catch {
      setNotice("Could not copy the ID. You can select it in the table.");
    }
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Shield size={23}/></span><div>Staff Portal<small>Community Operations</small></div></div>
      <nav aria-label="Staff tools">
        <p>REMOTE MANAGEMENT</p>
        {tabs.map(([id, label, Icon], index) => <div key={id}>
          {index === 2 && <p>STAFF TOOLS</p>}
          <button aria-current={tab === id ? "page" : undefined} className={tab === id ? "nav-item selected" : "nav-item"} onClick={() => { setTab(id); setNotice(""); }}><Icon size={18}/>{label}</button>
        </div>)}
      </nav>
      <div className="sidebar-footer"><span className={demo ? "dot demo" : "dot"}/>{demo ? "Demo workspace" : "API configured"}</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>{tab === "servers" || tab === "players" ? "Remote Management" : "Staff Tools"}</span><span className="divider">/</span><strong>{profile ? "Player profile" : tabs.find(item => item[0] === tab)[1]}</strong></header>
      <main className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-9 lg:px-11 lg:py-10">
        <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>
          {tab === "servers" && <div className="flex flex-wrap gap-2"><button className="button" disabled={loading} onClick={reload}><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Refresh</button><button className="button primary" onClick={() => setAction({ type: "announce", scope: "all" })}><Megaphone size={17}/>Announcement</button></div>}
          {profile && <button className="button" onClick={() => { setResult(undefined); setNotice(""); }}><Search size={16}/>Back to player lookup</button>}
        </div>
        {notice && <div className="notice" role="status"><Check size={17}/>{notice}<button className="icon-button ml-auto" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16}/></button></div>}
        {tab === "servers" && <>
          <div className="stats grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[[Server, "Active servers", servers.length], [Users, "Players online", totalPlayers], [Activity, "Average ping", latency]].map(([Icon, label, value]) => <section className="panel stat" key={label}><span><Icon size={17}/>{label}</span><strong>{data ? value : "—"}</strong></section>)}
          </div>
          {overviewError && <p className="error" role="alert">{overviewError}</p>}
          <section className="game-section"><h2>Experiences</h2><div className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 xl:grid-cols-4">
            {games.map(item => {
              const count = servers.filter(server => server.gameId === item.id);
              return <button key={item.id} aria-pressed={current?.id === item.id} className={current?.id === item.id ? "game active" : "game"} onClick={() => setGame(item.id)}>
                <span className={"game-icon " + item.color}><Gamepad2 size={20}/></span><span><strong>{item.name}</strong><small>{count.length} {count.length === 1 ? "server" : "servers"}</small></span>
              </button>;
            })}
            {!games.length && <p className="muted">{loading ? "Loading experiences…" : "No experiences available."}</p>}
          </div></section>
          <section className="panel server-panel"><div className="section-head"><div><h2>{current?.name ?? "Servers"}</h2><p>{visible.length} active {visible.length === 1 ? "server" : "servers"}</p></div>{current && <button className="button" onClick={() => setAction({ type: "announce", scope: "game", gameId: current.id })}><Megaphone size={16}/>Announce to game</button>}</div>
            <div className="overflow-x-auto"><table><thead><tr><th>Roblox server ID</th><th>Players</th><th>Ping</th><th>Uptime</th><th className="text-right">Actions</th></tr></thead><tbody>
              {visible.map(server => <tr key={server.id}><td><div className="flex items-center gap-2"><code>{server.id}</code><button className="icon-button" aria-label={"Copy server ID " + server.id} onClick={() => copy(server.id)}><Clipboard size={14}/></button></div></td>
                <td><div className="flex items-center gap-2"><meter value={Math.min(server.players, server.capacity)} max={Math.max(server.capacity, 1)} aria-label="Server capacity used"/><span>{server.players} / {server.capacity}</span></div></td>
                <td><span className={Number.isFinite(server.pingMs) ? "ping" : "muted"}>{Number.isFinite(server.pingMs) ? server.pingMs + " ms" : "—"}</span></td>
                <td>{duration(server.uptimeSeconds)}</td>
                <td className="text-right"><button className="button compact" aria-label={"Announce to server " + server.id} onClick={() => setAction({ type: "announce", scope: "server", gameId: server.gameId, serverId: server.id })}><Megaphone size={15}/>Announce</button></td></tr>)}
              {!visible.length && <tr><td colSpan={5} className="empty">{loading ? "Loading servers…" : "No active servers to display."}</td></tr>}
            </tbody></table></div>
          </section>
        </>}
        {tab === "players" && !profile && <section className="panel content-panel">
          <form onSubmit={event => { event.preventDefault(); if (query.trim()) lookup(query); }}>
            <label htmlFor="player-query">Roblox username or user ID</label><div className="flex flex-wrap gap-2"><input id="player-query" className="min-w-0 flex-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Enter a username or ID" required/><button className="button primary" disabled={searching || !query.trim()}><Search size={16}/>{searching ? "Searching…" : "Search"}</button></div>
          </form>
          {demo && <p className="muted mt-4">Try <button className="text-link" onClick={() => lookup("DemoBuilder")}>DemoBuilder</button> or <button className="text-link" onClick={() => lookup("100002")}>100002</button>.</p>}
          {searchError && <p role="alert" className="error">{searchError}</p>}
          {result === null && <p className="muted mt-5" role="status">No matching Roblox account found.</p>}
        </section>}
        {profile && <PlayerProfile player={profile} games={games} historyError={historyError}
          onAction={kind => setAction({ type: "moderate", kind, user: profile })}
          onRemove={entry => setAction({ type: "remove", entry, user: profile })}/>}
        {tab === "registry" && <section className="panel content-panel">{sheetUrl ? <><a className="text-link" href={sheetUrl} target="_blank" rel="noreferrer">Open in Google Sheets</a><iframe className="sheet" title="Staff Registry Google Sheet" src={sheetUrl}/></> : <><h2>Google Sheet setup</h2><p className="muted mt-2">Set the Staff Registry sheet URL to display your roster here.</p></>}</section>}
        {tab === "loa" && <section className="panel content-panel"><CalendarDays size={26} className="muted mb-3"/><h2>Coming soon</h2></section>}
      </main>
    </div>
    {action && <ActionDialog action={action} games={games} servers={servers} onClose={() => setAction(null)} onSuccess={completeAction}/>}
  </div>;
}

function PlayerProfile({ player, games, historyError, onAction, onRemove }) {
  const inGame = player.presence === "in_game";
  const joinUrl = inGame ? safeJoinUrl(player.joinUrl) : null;
  const status = { in_game: "In game", offline: "Offline", online: "Online" }[player.presence] ?? "Status unavailable";
  const history = Array.isArray(player.moderationHistory)
    ? [...player.moderationHistory].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    : null;
  return <div className="grid gap-4">
    <div className="grid gap-3 md:grid-cols-2">
      <section className="panel content-panel">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2>Roblox presence</h2><span className={inGame ? "ping" : "muted"}>{status}</span></div>
        {inGame && <div className="presence"><div>{games.find(item => item.id === player.gameId)?.name ?? player.gameId ?? "Current server"}{player.serverId && <code className="block mt-1">{player.serverId}</code>}</div>{joinUrl ? <a className="button" href={joinUrl} target="_blank" rel="noreferrer">Join server</a> : <button className="button" disabled title="The API must supply a Roblox join link">Join server</button>}</div>}
      </section>
      <section className="panel content-panel"><h2 className="flex items-center gap-2"><Clock size={18}/>Total playtime</h2><p className="mt-2 text-2xl font-bold">{duration(player.playtimeSeconds)}</p><p className="muted mt-1">Across community games</p></section>
    </div>
    <section className="panel content-panel"><h2>Moderation actions</h2><div className="mt-3 flex flex-wrap gap-2">
      {Object.entries(actionLabels).map(([kind, label]) => <button key={kind} className={kind === "ban" ? "button danger" : "button"} disabled={kind === "kick" && !inGame} onClick={() => onAction(kind)}>{label}</button>)}
    </div></section>
    <section className="panel"><div className="section-head"><h2>Moderation history</h2></div>
      {historyError && <p className="error mx-4" role="alert">{historyError}</p>}
      {history?.length ? <div className="overflow-x-auto"><table><thead><tr><th>Action</th><th>Reason</th><th>Moderator</th><th>Date</th><th className="text-right">Manage</th></tr></thead><tbody>
        {history.map(entry => <tr key={entry.id}><td>{moderationLabels[entry.action] ?? entry.action}</td><td className="min-w-48 whitespace-normal">{entry.reason || "—"}</td><td>{entry.moderator || "—"}</td><td>{Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt).toLocaleString() : "—"}</td><td className="text-right"><button className="button compact" onClick={() => onRemove(entry)} aria-label={"Remove " + (moderationLabels[entry.action] ?? entry.action).toLowerCase() + " record"}>Remove</button></td></tr>)}
      </tbody></table></div> : <p className="muted px-5 pb-5">{history ? "No moderation actions recorded." : "Moderation history unavailable."}</p>}
    </section>
  </div>;
}

function ActionDialog({ action, games, servers, onClose, onSuccess }) {
  const ref = useRef(null);
  const [scope, setScope] = useState(action.scope ?? "all");
  const [gameId, setGameId] = useState(action.gameId ?? games[0]?.id ?? "");
  const [serverId, setServerId] = useState(action.serverId ?? "");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const announcing = action.type === "announce";
  const removing = action.type === "remove";
  const title = removing ? "Remove history entry" : announcing ? "Send announcement" : actionLabels[action.kind];
  useEffect(() => { ref.current.showModal(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (pending || !content.trim()) return;
    setPending(true);
    setError("");
    try {
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
      {announcing ? <><label htmlFor="scope">Audience</label><select id="scope" value={scope} onChange={event => setScope(event.target.value)} disabled={pending}><option value="all">All games</option><option value="game">One game</option><option value="server">One server</option></select>
        {scope !== "all" && <><label htmlFor="experience">Game</label><select id="experience" required value={gameId} onChange={event => { setGameId(event.target.value); setServerId(""); }} disabled={pending}><option value="">Select a game</option>{games.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></>}
        {scope === "server" && <><label htmlFor="instance">Server ID</label><select id="instance" required value={serverId} onChange={event => setServerId(event.target.value)} disabled={pending}><option value="">Select a server</option>{servers.filter(item => item.gameId === gameId).map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></>}
      </> : <p className="muted mt-3">@{action.user.username} · {action.user.id}</p>}
      {removing && <div className="presence"><div><strong>{moderationLabels[action.entry.action] ?? action.entry.action}</strong><p className="muted">{action.entry.reason || "No reason recorded"}</p><p className="muted">This removes the history entry. Active penalties stay in effect.</p></div></div>}
      <label htmlFor="content">{removing ? "Reason for removal" : announcing ? "Message" : "Reason"}</label><textarea id="content" required rows={4} value={content} onChange={event => setContent(event.target.value)} disabled={pending}/>
      {demo && <p className="muted mt-2">Demo mode. This action stays in the portal.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="flex justify-end gap-2 mt-5"><button type="button" className="button" disabled={pending} onClick={onClose}>Cancel</button><button className={removing || action.kind === "ban" ? "button danger" : "button primary"} disabled={pending || !content.trim()}>{pending ? "Submitting…" : title}</button></div>
    </form>
  </dialog>;
}
