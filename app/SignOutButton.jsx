"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return <button className="sign-out-button" type="button" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Sign out" title="Sign out">
    <LogOut size={15}/>
  </button>;
}
