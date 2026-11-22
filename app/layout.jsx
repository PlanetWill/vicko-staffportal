import "./globals.css";
export const metadata = {
  title: { default: "Vicko Staff", template: "%s · Vicko Staff" },
  description: "Staff operations for the Vicko Roblox community.",
};
export default function Layout({ children }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
