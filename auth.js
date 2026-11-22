import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { discordRoleName, getAuthorizedDiscordRoles } from "./lib/discord-access";

export const isDiscordAuthConfigured = () => Boolean(
  (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32 &&
  process.env.AUTH_DISCORD_ID?.trim() &&
  process.env.AUTH_DISCORD_SECRET?.trim() &&
  /^\d{17,20}$/.test(process.env.DISCORD_GUILD_ID?.trim() ?? "") &&
  process.env.DISCORD_ALLOWED_ROLE_IDS?.split(",").some(role => /^\d{17,20}$/.test(role.trim()))
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 },
  pages: { signIn: "/login" },
  providers: [Discord({
    clientId: process.env.AUTH_DISCORD_ID,
    clientSecret: process.env.AUTH_DISCORD_SECRET,
    issuer: "https://discord.com",
    authorization: { params: { scope: "identify guilds.members.read" } },
    checks: ["state", "pkce"],
  })],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "discord" || !account.access_token || !profile?.id) return false;
      const roles = await getAuthorizedDiscordRoles(account.access_token);
      return Array.isArray(roles) && roles.length > 0;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "discord") {
        const discordId = typeof profile?.id === "string" ? profile.id : user?.id;
        const roles = account.access_token ? await getAuthorizedDiscordRoles(account.access_token) : null;
        token.discordId = discordId;
        token.discordRoles = roles ?? [];
        token.staffAuthorized = Boolean(discordId && roles?.length);
        token.discordRoleName = roles?.length ? discordRoleName(roles[0]) : "Authorized role";
        token.staffAuthenticatedAt = Math.floor(Date.now() / 1000);
        token.name = profile?.global_name || profile?.username || user?.name || token.name;
        token.picture = user?.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = typeof token.discordId === "string" ? token.discordId : "";
        session.user.discordRoles = Array.isArray(token.discordRoles) ? token.discordRoles : [];
        const firstAuthorizedRole = Array.isArray(token.discordRoles) ? token.discordRoles[0] : null;
        session.user.discordRoleName = firstAuthorizedRole ? discordRoleName(firstAuthorizedRole) : "Authorized role";
        const authenticatedAt = Number(token.staffAuthenticatedAt);
        const withinAbsoluteSession = Number.isFinite(authenticatedAt) && Math.floor(Date.now() / 1000) - authenticatedAt < 60 * 60;
        session.user.staffAuthorized = token.staffAuthorized === true && withinAbsoluteSession;
      }
      return session;
    },
  },
});
