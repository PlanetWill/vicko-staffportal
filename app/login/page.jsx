import LoginButton from "./login-button";
import { auth, isDiscordAuthConfigured } from "../../auth";
import { redirect } from "next/navigation";

const messages = {
  AccessDenied: "Your Discord account does not have an approved staff role in this server.",
  OAuthAccountNotLinked: "This Discord account could not be verified. Please try again.",
  OAuthSignin: "Discord sign-in could not start. Please try again.",
  OAuthCallback: "Discord sign-in could not be completed. Please try again.",
  SessionExpired: "Your session expired. Sign in again to continue.",
  Configuration: "Discord sign-in is not configured yet. Ask an administrator to complete the server setup.",
};

function safeCallbackPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/servers";
  return value;
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const configured = isDiscordAuthConfigured();
  if (configured) {
    const session = await auth();
    if (session?.user?.staffAuthorized) redirect(callbackUrl);
  }

  return <main className="login-page">
    <section className="login-card">
      <img className="login-logo" src="/brand/vicko-logo.png" alt="Vicko"/>
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>Sign in to Vicko</h1>
      <p className="login-description">Continue with your Discord account. Access is limited to approved staff roles.</p>
      {error && <p className="login-message" role="alert">{messages[error] ?? "Sign-in could not be completed. Please try again."}</p>}
      {!configured && !error && <p className="login-message" role="status">{messages.Configuration}</p>}
      {configured && <LoginButton callbackUrl={callbackUrl}/>}
      <p className="login-footnote">Your account must belong to the configured Discord server and have an authorized role.</p>
    </section>
  </main>;
}
