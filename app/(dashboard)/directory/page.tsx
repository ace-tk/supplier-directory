import { StreamedDirectoryView } from "@/components/suppliers/StreamedDirectoryView";

// Auth is already enforced by this route's layout (app/(dashboard)/layout.tsx
// at /directory; app/(buyer)/layout.tsx when re-exported at /buyer/suppliers
// — see app/(buyer)/buyer/suppliers/page.tsx). The directory data itself is
// not user-scoped (GET /api/suppliers has never required a session either).
export default function DirectoryPage() {
  // Still fetched on the server (the same query GET /api/suppliers already
  // runs, via the shared getSupplierDirectory() helper) so the directory
  // renders with real data without a client round-trip — but inside a
  // Suspense boundary, so the shell + skeleton stream first instead of the
  // whole response waiting on the query. DirectoryView/useSuppliers keep
  // their own fetch path for use whenever initial data isn't provided.
  return <StreamedDirectoryView />;
}
