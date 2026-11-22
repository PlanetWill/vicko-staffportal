const DISCORD_API = "https://discord.com/api/v10";

export function allowedDiscordRoleIds() {
  return (process.env.DISCORD_ALLOWED_ROLE_IDS ?? "")
    .split(",")
    .map(roleId => roleId.trim())
    .filter(Boolean);
}

export function discordRoleName(roleId) {
  const entries = (process.env.DISCORD_ROLE_NAME_MAP ?? "").split(";");
  for (const entry of entries) {
    const match = entry.trim().match(/^(\d{17,20})=(.+)$/);
    if (match?.[1] === roleId) return match[2].trim();
  }
  return "Authorized role";
}

export async function getAuthorizedDiscordRoles(accessToken) {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const allowed = allowedDiscordRoleIds();
  if (!accessToken || !guildId || allowed.length === 0) return null;

  try {
    const response = await fetch(`${DISCORD_API}/users/@me/guilds/${encodeURIComponent(guildId)}/member`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const member = await response.json();
    if (!Array.isArray(member.roles)) return null;
    const memberRoles = new Set(member.roles.filter(role => typeof role === "string"));
    return allowed.filter(roleId => memberRoles.has(roleId));
  } catch {
    return null;
  }
}
