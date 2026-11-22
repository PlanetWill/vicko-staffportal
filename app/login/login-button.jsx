"use client";

import { signIn } from "next-auth/react";
import { MessageCircle } from "lucide-react";

export default function LoginButton({ callbackUrl }) {
  return <button className="button primary login-button" onClick={() => signIn("discord", { callbackUrl })}>
    <MessageCircle size={17}/>Continue with Discord
  </button>;
}
