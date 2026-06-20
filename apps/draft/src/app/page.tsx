import { redirect } from "next/navigation";

// The root path has no UI of its own — the proxy already steers everyone to
// /login (which then bounces to the role-appropriate home). Redirect here too
// so a direct hit on "/" resolves cleanly.
export default function RootPage() {
  redirect("/login");
}
