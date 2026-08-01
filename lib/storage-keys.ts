// Client-side draft caches keyed by browser storage, not tied to any one
// account. Cleared on logout so a new session on the same browser never
// inherits another user's in-progress draft.
export const SOURCING_REQUEST_DRAFT_KEY = "sb_sourcing_draft";
export const SUPPLIER_PORTAL_DRAFT_KEY = "sb_portal_draft_id";
