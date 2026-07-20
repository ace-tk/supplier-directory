export type SeedMessage = {
  sender: "user" | "supplier";
  content: string;
  type?: "TEXT" | "PRODUCT" | "QUOTATION";
  status?: "sent" | "delivered" | "seen";
  offsetMinutes: number; // minutes before "now"
};

export type SeedConversation = {
  supplierIndex: number; // 0-based index into SupplierListing
  unreadCount: number;
  pinned: boolean;
  highPriority: boolean;
  messages: SeedMessage[];
};

export const CONVERSATION_SCRIPTS: SeedMessage[][] = [
  // Thread 1 — MOQ Negotiation
  [
    { sender: "user", content: "Hello! I came across your listing on SupplyBase and I'm interested in your stainless steel cookware sets. Could you share more details on pricing and MOQ?", offsetMinutes: 1440, status: "seen" },
    { sender: "supplier", content: "Hi! Thanks for reaching out. Our MOQ is 500 units per SKU. Pricing starts at $12.50/unit for the 3-piece set and $18.00/unit for the 5-piece set at MOQ.", offsetMinutes: 1380 },
    { sender: "user", content: "That's a bit high for our first order. Could you accommodate 200 units at a slightly higher unit price?", offsetMinutes: 1320, status: "seen" },
    { sender: "supplier", content: "For 200 units, we can do $15.00/unit for the 3-piece and $22.00/unit for the 5-piece. We also offer a 5% discount for orders above 1000 units.", offsetMinutes: 1260 },
    { sender: "user", content: "Great! Can you send a formal quotation with lead time and packaging details?", offsetMinutes: 1200, status: "seen" },
    { sender: "supplier", content: "Of course! Lead time is 25 days from order confirmation. Standard packaging is kraft box with foam insert. I'll email you the PI shortly. What's the best email to send to?", offsetMinutes: 1140 },
    { sender: "user", content: "Please send it to procurement@mycompany.com. Also, do you offer OEM packaging?", offsetMinutes: 60, status: "seen" },
    { sender: "supplier", content: "Yes, OEM is available for orders of 500+ units. Add $0.80/unit for custom printing. Our designer will need your artwork in AI or EPS format.", offsetMinutes: 30 },
  ],
  // Thread 2 — Sample Request
  [
    { sender: "user", content: "Hi, we're a retail chain in the UK looking for bamboo cutting boards. Can you send samples before we place a bulk order?", offsetMinutes: 720, status: "seen" },
    { sender: "supplier", content: "Hello! Yes, we can send samples. We have 5 sizes available. Sample cost is $15 per piece including DHL shipping to UK. This is refunded on your first bulk order.", offsetMinutes: 700 },
    { sender: "user", content: "Perfect. We'd like 2 samples of your 30cm and 40cm boards. Can you share your bank details for payment?", offsetMinutes: 680, status: "seen" },
    { sender: "supplier", content: "Great choice! I'll share our bank details via email. Samples will be dispatched within 2 working days. Tracking number will be shared on WhatsApp.", offsetMinutes: 660 },
    { sender: "user", content: "Received the tracking. Samples look great from the photos you shared!", offsetMinutes: 200, status: "seen" },
    { sender: "supplier", content: "Excellent! We'd love to hear your feedback once you have them in hand. Our best-seller is the 40cm with the juice groove — it has been very popular in European markets.", offsetMinutes: 180 },
  ],
  // Thread 3 — Payment Terms
  [
    { sender: "user", content: "We want to place an order for 2000 units of your LED work lights. What are your payment terms?", offsetMinutes: 5000, status: "seen" },
    { sender: "supplier", content: "For new customers, our standard terms are 30% TT deposit + 70% before shipment. After 3 successful orders, we can offer Net 30 terms.", offsetMinutes: 4800 },
    { sender: "user", content: "We'd prefer LC at sight. Is that acceptable?", offsetMinutes: 4600, status: "seen" },
    { sender: "supplier", content: "We accept LC for orders above $30,000. For your order of 2000 units at $18/piece, the total would be $36,000 — so yes, LC is fine.", offsetMinutes: 4400 },
    { sender: "user", content: "Excellent. We'll instruct our bank to issue the LC. Can you confirm your full company name and bank details for the LC application?", offsetMinutes: 4200, status: "seen" },
    { sender: "supplier", content: "I'll send you the complete banking details and company registration documents via email. Please also share the exact goods description you want on the invoice.", offsetMinutes: 4000 },
    { sender: "user", content: "Sent the email. Please also include CE and RoHS certifications with the shipment.", offsetMinutes: 45, status: "sent" },
  ],
  // Thread 4 — Lead Time & Shipping
  [
    { sender: "user", content: "Quick question — what's your current lead time for the ceramic planters? We have a spring season deadline of March 15.", offsetMinutes: 300, status: "seen" },
    { sender: "supplier", content: "Currently our production lead time is 30 days. However, we have some ready stock (about 800 units) that can ship within 5 days.", offsetMinutes: 280 },
    { sender: "user", content: "How much of the ready stock do you have in the 6-inch glazed finish?", offsetMinutes: 260, status: "seen" },
    { sender: "supplier", content: "We have 650 units of 6-inch in terracotta glaze and 200 in matte white. Both are packed and ready for inspection.", offsetMinutes: 240 },
    { sender: "user", content: "We'll take all 650 terracotta. Can you arrange sea freight to Rotterdam? We'll share our forwarder details.", offsetMinutes: 120, status: "seen" },
    { sender: "supplier", content: "Confirmed! I'll prepare the packing list and commercial invoice. Please share your forwarder contact so we can coordinate pickup. ETA to Rotterdam should be 28-32 days from loading.", offsetMinutes: 90 },
  ],
  // Thread 5 — Certification Query
  [
    { sender: "user", content: "Do your organic cotton towels carry GOTS certification? We require this for our EU retail partners.", offsetMinutes: 2000, status: "seen" },
    { sender: "supplier", content: "Yes, all our organic cotton products are GOTS certified. Certificate number is GOT-TX-2024-008. I can share the full certificate PDF.", offsetMinutes: 1900 },
    { sender: "user", content: "Please share the PDF. Also, do you have OEKO-TEX Standard 100 for the coloured variants?", offsetMinutes: 1800, status: "seen" },
    { sender: "supplier", content: "Yes! OEKO-TEX cert is valid until December 2025. Sharing both documents now. The lab test reports are also included.", offsetMinutes: 1700 },
    { sender: "user", content: "Perfect. We're placing a trial order of 500 sets to test market response. Can you accommodate our private label requirement?", offsetMinutes: 100, status: "seen" },
    { sender: "supplier", content: "Absolutely. Private label is available for 300+ units. Please send your logo file and preferred label placement. Our turnaround for custom labelling is 3 extra days.", offsetMinutes: 60 },
  ],
  // Thread 6 — Production Capacity
  [
    { sender: "user", content: "We're considering you as a strategic supplier for our furniture range. What is your monthly production capacity for solid wood chairs?", offsetMinutes: 10000, status: "seen" },
    { sender: "supplier", content: "Our current monthly capacity is 5,000 units of dining chairs. We can scale to 8,000 units with a 60-day ramp-up if you can commit to a 6-month rolling forecast.", offsetMinutes: 9800 },
    { sender: "user", content: "That works for us. We'd need about 2,000 units/month initially. Can you handle customisation — fabric choice, leg finishes, cushion options?", offsetMinutes: 9600, status: "seen" },
    { sender: "supplier", content: "Yes, we offer 12 fabric options, 6 leg finishes (natural oak, walnut, black, white, gold, chrome), and 3 cushion densities. Samples of all variants available.", offsetMinutes: 9400 },
    { sender: "user", content: "Let's schedule a factory visit. Our sourcing team will be in Guangzhou in February.", offsetMinutes: 500, status: "seen" },
    { sender: "supplier", content: "Wonderful! We'll arrange everything — factory tour, sample room visit, and lunch with our management team. Please share your travel dates.", offsetMinutes: 400 },
    { sender: "user", content: "Dates confirmed: Feb 18-19. Team of 3 people. Will also need NDA signed before the visit.", offsetMinutes: 20, status: "delivered" },
  ],
  // Thread 7 — Quote Follow-up
  [
    { sender: "user", content: "Following up on the quotation you sent for the stationery set (PO-2024-187). We reviewed it internally.", offsetMinutes: 800, status: "seen" },
    { sender: "supplier", content: "Hello! Yes, I remember. Any feedback on the pricing? We're eager to start this partnership.", offsetMinutes: 780 },
    { sender: "user", content: "The unit price is fine but the freight cost seems high. Can you check if there are cheaper shipping options to Dubai?", offsetMinutes: 760, status: "seen" },
    { sender: "supplier", content: "I've checked with our freight partners. We found a consolidation option via Cosco that saves about $320 on the total freight. Want me to revise the quotation?", offsetMinutes: 740 },
    { sender: "user", content: "Yes please. Also update the quantity to 1500 units instead of 1000.", offsetMinutes: 40, status: "seen" },
    { sender: "supplier", content: "Revised quotation sent! Unit price drops to $8.20 at 1500 units (was $9.00). New total with revised freight: $13,580. Valid for 15 days.", offsetMinutes: 15 },
  ],
];
