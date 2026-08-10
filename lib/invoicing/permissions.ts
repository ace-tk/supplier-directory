// Central permission resolver for Invoice Management. Every server action
// and page funnels through this, so the access rules live in one place.
//
// Deliberately narrower than Supply Chain's owner/admin/shared-team model:
// an invoice is a financial document with exactly two legitimate viewers —
// the owner (creator) and the named counterparty — and no admin bypass, to
// avoid inventing a broad cross-org permission the product spec warns
// against. This matches the existing owner-only precedent already used by
// Catalog and Content management.

export interface InvoiceAccess {
  canView: boolean;
  isOwner: boolean;
  isCounterparty: boolean;
  canEdit: boolean;
  canDuplicate: boolean;
  canChangeStatus: boolean;
  canArchive: boolean;
}

const NO_ACCESS: InvoiceAccess = {
  canView: false,
  isOwner: false,
  isCounterparty: false,
  canEdit: false,
  canDuplicate: false,
  canChangeStatus: false,
  canArchive: false,
};

export function resolveInvoiceAccess(input: {
  userId: string;
  invoice: { ownerId: string; counterpartyUserId: string | null };
}): InvoiceAccess {
  const { userId, invoice } = input;

  if (userId === invoice.ownerId) {
    return {
      canView: true,
      isOwner: true,
      isCounterparty: false,
      canEdit: true,
      canDuplicate: true,
      canChangeStatus: true,
      canArchive: true,
    };
  }

  if (invoice.counterpartyUserId && userId === invoice.counterpartyUserId) {
    return {
      ...NO_ACCESS,
      canView: true,
      isCounterparty: true,
    };
  }

  return NO_ACCESS;
}
