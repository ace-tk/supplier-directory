"use server";

// Owner-scoped Warehouse / Retail Store lists for the Product module's
// location assignment — mirrors services/expenses.ts's
// listExpenseCustomCategoriesAction/createExpenseCustomCategoryAction
// pattern (simple named list, create-or-return-existing on the unique
// constraint).

import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUser } from "@/lib/session";

export type LocationActionResult<T> = { success: true; data: T } | { success: false; error: string };

export interface LocationOption {
  id: string;
  name: string;
}

async function requireUser() {
  return getUser();
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function listWarehousesAction(): Promise<LocationActionResult<LocationOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.warehouse.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: rows };
}

export async function createWarehouseAction(name: string): Promise<LocationActionResult<LocationOption>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Warehouse name is required." };
  if (trimmed.length > 80) return { success: false, error: "Warehouse name is too long." };

  const existing = await db.warehouse.findUnique({
    where: { ownerId_name: { ownerId: user.id, name: trimmed } },
    select: { id: true, name: true },
  });
  if (existing) return { success: true, data: existing };

  try {
    const created = await db.warehouse.create({
      data: { ownerId: user.id, name: trimmed },
      select: { id: true, name: true },
    });
    return { success: true, data: created };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const row = await db.warehouse.findUnique({
        where: { ownerId_name: { ownerId: user.id, name: trimmed } },
        select: { id: true, name: true },
      });
      if (row) return { success: true, data: row };
    }
    return { success: false, error: "Couldn't create warehouse." };
  }
}

export async function listRetailStoresAction(): Promise<LocationActionResult<LocationOption[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const rows = await db.retailStore.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: rows };
}

export async function createRetailStoreAction(name: string): Promise<LocationActionResult<LocationOption>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Retail store name is required." };
  if (trimmed.length > 80) return { success: false, error: "Retail store name is too long." };

  const existing = await db.retailStore.findUnique({
    where: { ownerId_name: { ownerId: user.id, name: trimmed } },
    select: { id: true, name: true },
  });
  if (existing) return { success: true, data: existing };

  try {
    const created = await db.retailStore.create({
      data: { ownerId: user.id, name: trimmed },
      select: { id: true, name: true },
    });
    return { success: true, data: created };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const row = await db.retailStore.findUnique({
        where: { ownerId_name: { ownerId: user.id, name: trimmed } },
        select: { id: true, name: true },
      });
      if (row) return { success: true, data: row };
    }
    return { success: false, error: "Couldn't create retail store." };
  }
}
