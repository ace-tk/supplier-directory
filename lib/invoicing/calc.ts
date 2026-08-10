import Decimal from "decimal.js";

/**
 * Shared invoice calculation engine. Pure and isomorphic — imported
 * unmodified by both the client-side live preview and the server-side
 * recalculation-before-persist, so totals can never drift between what a
 * user sees while editing and what actually gets saved.
 *
 * All monetary results are returned as decimal strings (never JS numbers)
 * to avoid float precision loss crossing the Server Action boundary.
 */

export type CalcTaxMode = "EXCLUSIVE" | "INCLUSIVE";
export type CalcTaxBreakup = "SINGLE" | "CGST_SGST" | "IGST";

export interface CalcLineItemInput {
  quantity: number | string;
  rate: number | string;
  discountPercent?: number | string;
  taxPercent?: number | string;
}

export interface CalcLineItemResult {
  grossAmount: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
}

export interface CalcInvoiceInput {
  taxMode: CalcTaxMode;
  taxBreakup: CalcTaxBreakup;
  items: CalcLineItemInput[];
  shippingCharge?: number | string;
  miscCharge?: number | string;
  additionalDiscount?: number | string;
  /** Round grandTotal to the nearest whole currency unit. Defaults to true. */
  applyRoundOff?: boolean;
}

export interface CalcInvoiceResult {
  items: CalcLineItemResult[];
  subtotal: string;
  itemDiscountTotal: string;
  taxableAmount: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  taxTotal: string;
  shippingCharge: string;
  miscCharge: string;
  additionalDiscount: string;
  roundOff: string;
  grandTotal: string;
}

const ZERO = new Decimal(0);

function d(value: number | string | undefined | null): Decimal {
  if (value === undefined || value === null || value === "") return ZERO;
  const parsed = new Decimal(value);
  return parsed.isFinite() ? parsed : ZERO;
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function moneyStr(value: Decimal): string {
  return money(value).toFixed(2);
}

function calculateLineItem(
  item: CalcLineItemInput,
  taxMode: CalcTaxMode,
  taxBreakup: CalcTaxBreakup
): CalcLineItemResult {
  const quantity = d(item.quantity);
  const rate = d(item.rate);
  const discountPercent = d(item.discountPercent);
  const taxPercent = d(item.taxPercent);

  const enteredGross = money(quantity.mul(rate));

  // In INCLUSIVE mode, the entered rate already contains tax — extract the
  // pre-tax gross first so discount/tax are computed on the true taxable
  // basis while lineTotal still equals what the user typed.
  const grossAmount =
    taxMode === "INCLUSIVE" && taxPercent.gt(0)
      ? money(enteredGross.div(taxPercent.div(100).plus(1)))
      : enteredGross;

  const discountAmount = money(grossAmount.mul(discountPercent).div(100));
  const taxableAmount = money(grossAmount.minus(discountAmount));
  const taxAmount = money(taxableAmount.mul(taxPercent).div(100));

  let cgstAmount = ZERO;
  let sgstAmount = ZERO;
  let igstAmount = ZERO;
  if (taxBreakup === "CGST_SGST") {
    cgstAmount = money(taxAmount.div(2));
    sgstAmount = money(taxAmount.minus(cgstAmount));
  } else if (taxBreakup === "IGST") {
    igstAmount = taxAmount;
  }

  // lineTotal always reflects what the buyer actually pays for this line:
  // taxable amount plus tax, regardless of entry mode.
  const lineTotal = money(taxableAmount.plus(taxAmount));

  return {
    grossAmount: moneyStr(grossAmount),
    discountAmount: moneyStr(discountAmount),
    taxableAmount: moneyStr(taxableAmount),
    taxAmount: moneyStr(taxAmount),
    cgstAmount: moneyStr(cgstAmount),
    sgstAmount: moneyStr(sgstAmount),
    igstAmount: moneyStr(igstAmount),
    lineTotal: moneyStr(lineTotal),
  };
}

export function calculateInvoiceTotals(input: CalcInvoiceInput): CalcInvoiceResult {
  const items = input.items.map((item) =>
    calculateLineItem(item, input.taxMode, input.taxBreakup)
  );

  const sum = (values: string[]) =>
    values.reduce((acc, v) => acc.plus(d(v)), ZERO);

  const subtotal = sum(items.map((i) => i.grossAmount));
  const itemDiscountTotal = sum(items.map((i) => i.discountAmount));
  const taxableAmount = sum(items.map((i) => i.taxableAmount));
  const cgstTotal = sum(items.map((i) => i.cgstAmount));
  const sgstTotal = sum(items.map((i) => i.sgstAmount));
  const igstTotal = sum(items.map((i) => i.igstAmount));
  const taxTotal = sum(items.map((i) => i.taxAmount));

  const shippingCharge = money(d(input.shippingCharge));
  const miscCharge = money(d(input.miscCharge));
  const additionalDiscount = money(d(input.additionalDiscount));

  const grandTotalPreRound = money(
    taxableAmount
      .plus(taxTotal)
      .plus(shippingCharge)
      .plus(miscCharge)
      .minus(additionalDiscount)
  );

  const applyRoundOff = input.applyRoundOff ?? true;
  const roundedGrandTotal = applyRoundOff
    ? grandTotalPreRound.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    : grandTotalPreRound;
  const roundOff = money(roundedGrandTotal.minus(grandTotalPreRound));
  const grandTotal = money(grandTotalPreRound.plus(roundOff));

  return {
    items,
    subtotal: moneyStr(subtotal),
    itemDiscountTotal: moneyStr(itemDiscountTotal),
    taxableAmount: moneyStr(taxableAmount),
    cgstTotal: moneyStr(cgstTotal),
    sgstTotal: moneyStr(sgstTotal),
    igstTotal: moneyStr(igstTotal),
    taxTotal: moneyStr(taxTotal),
    shippingCharge: moneyStr(shippingCharge),
    miscCharge: moneyStr(miscCharge),
    additionalDiscount: moneyStr(additionalDiscount),
    roundOff: moneyStr(roundOff),
    grandTotal: moneyStr(grandTotal),
  };
}
