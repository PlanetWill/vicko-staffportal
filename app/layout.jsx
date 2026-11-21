import "./globals.css";
export const metadata = { title: "Staff Portal", description: "Roblox community operations" };
export default function Layout({ children }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
