"use client";

export interface RequestVideoPayload {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  buyerName: string;
  company: string;
  email: string;
  phone: string;
  message?: string;
}

export interface CounterOfferPayload {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  offerPrice: string;
  quantity: string;
  expectedDelivery: string;
  notes?: string;
}

function mockLatency(ms = 700): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock submit — swap the body for a real `POST /api/video-requests` call
// later; callers only depend on this function's signature.
export async function submitVideoRequest(payload: RequestVideoPayload): Promise<{ success: true }> {
  await mockLatency();
  console.info("[mock] video request submitted", payload);
  return { success: true };
}

// Mock submit — swap the body for a real `POST /api/counter-offers` call
// later; callers only depend on this function's signature.
export async function submitCounterOffer(payload: CounterOfferPayload): Promise<{ success: true }> {
  await mockLatency();
  console.info("[mock] counter offer submitted", payload);
  return { success: true };
}
