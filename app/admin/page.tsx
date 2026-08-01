import { redirect } from "next/navigation";

// The Admin Portal's real content lives at /dashboard (and its sibling
// pages), unchanged from before role-based routing existed — this route
// just gives Admin the canonical /admin entry point the other two portals
// have. Auth + role enforcement happens in app/(dashboard)/layout.tsx.
export default function AdminEntryPage() {
  redirect("/dashboard");
}
