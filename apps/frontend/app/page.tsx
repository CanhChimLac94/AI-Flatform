import { redirect } from "next/navigation";

// Root redirect: authenticated users go to /chat, others to /auth/login
// The actual auth guard is in /chat/page.tsx (client-side, reads localStorage)
export default function RootPage() {
  redirect("/chat");
}
