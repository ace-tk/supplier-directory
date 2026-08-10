import type { ExpenseCategory } from "@/types/expense";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SHIPPING: "Shipping",
  TRAVEL: "Travel",
  PACKAGING: "Packaging",
  TRANSPORTATION: "Transportation",
  SAMPLES: "Samples",
  MARKETING: "Marketing",
  FREELANCER: "Freelancer",
  OFFICE: "Office",
  MISCELLANEOUS: "Miscellaneous",
  OTHER: "Other",
};

export const EXPENSE_CATEGORY_OPTIONS: ExpenseCategory[] = [
  "SHIPPING",
  "TRAVEL",
  "PACKAGING",
  "TRANSPORTATION",
  "SAMPLES",
  "MARKETING",
  "FREELANCER",
  "OFFICE",
  "MISCELLANEOUS",
  "OTHER",
];
