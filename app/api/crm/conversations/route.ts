import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONVERSATION_SCRIPTS } from "@/data/crm-seed";

async function seedConversations() {
  const suppliers = await db.supplierListing.findMany({ take: 20, orderBy: { createdAt: "asc" } });
  if (suppliers.length === 0) return;

  const now = new Date();

  for (let i = 0; i < Math.min(suppliers.length, CONVERSATION_SCRIPTS.length); i++) {
    const supplier = suppliers[i];
    const script = CONVERSATION_SCRIPTS[i];

    const existing = await db.conversation.findUnique({ where: { supplierId: supplier.id } });
    if (existing) continue;

    const lastMsg = script[script.length - 1];
    const lastMsgAt = new Date(now.getTime() - lastMsg.offsetMinutes * 60000);

    await db.conversation.create({
      data: {
        supplierId: supplier.id,
        unreadCount: script.filter(m => m.sender === "supplier").length > 3 ? 2 : 0,
        pinned: i === 0 || i === 5,
        highPriority: i === 2 || i === 5,
        lastMessageAt: lastMsgAt,
        messages: {
          create: script.map((m) => ({
            sender: m.sender,
            type: m.type ?? "TEXT",
            content: m.content,
            status: m.status ?? (m.sender === "user" ? "sent" : undefined),
            createdAt: new Date(now.getTime() - m.offsetMinutes * 60000),
          })),
        },
        activities: {
          create: [
            { title: "Conversation Created", type: "System", createdAt: new Date(now.getTime() - 1500 * 60000) },
            { title: "First Message Sent", type: "Message", createdAt: new Date(now.getTime() - 1440 * 60000) },
          ],
        },
      },
    });
  }

  // Seed remaining suppliers with simple conversations
  for (let i = CONVERSATION_SCRIPTS.length; i < suppliers.length; i++) {
    const supplier = suppliers[i];
    const existing = await db.conversation.findUnique({ where: { supplierId: supplier.id } });
    if (existing) continue;

    await db.conversation.create({
      data: {
        supplierId: supplier.id,
        unreadCount: Math.random() > 0.7 ? Math.floor(Math.random() * 4) + 1 : 0,
        lastMessageAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60000),
        messages: {
          create: [
            { sender: "user", type: "TEXT", content: "Hi, I'm interested in your products. Could you share your catalogue?", status: "seen", createdAt: new Date(now.getTime() - 48 * 60 * 60000) },
            { sender: "supplier", type: "TEXT", content: "Hello! Thanks for reaching out. Happy to share our full catalogue. Which category are you most interested in?", createdAt: new Date(now.getTime() - 47 * 60 * 60000) },
          ],
        },
      },
    });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");

    if (supplierId) {
      const messagesInclude = {
        orderBy: { createdAt: "asc" as const },
        include: { supplyChain: { select: { id: true, name: true, orderNumber: true, status: true } } },
      };

      let conv = await db.conversation.findUnique({
        where: { supplierId },
        include: {
          supplier: true,
          messages: messagesInclude,
          notes: { orderBy: { createdAt: "desc" } },
          tasks: { orderBy: { createdAt: "desc" } },
          activities: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!conv) {
        conv = await db.conversation.create({
          data: {
            supplierId,
            activities: { create: [{ title: "Conversation Created", type: "System" }] },
          },
          include: {
            supplier: true,
            messages: messagesInclude,
            notes: { orderBy: { createdAt: "desc" } },
            tasks: { orderBy: { createdAt: "desc" } },
            activities: { orderBy: { createdAt: "desc" } },
          },
        });
      }

      return NextResponse.json(conv);
    }

    // Check if seeding needed
    const count = await db.conversation.count();
    if (count === 0) await seedConversations();

    const conversations = await db.conversation.findMany({
      include: {
        supplier: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ pinned: "desc" }, { lastMessageAt: "desc" }],
    });

    return NextResponse.json(conversations);
  } catch (err) {
    console.error("[GET /api/crm/conversations]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, content, type = "TEXT", productId, supplyChainId } = body;

    if (!conversationId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const message = await db.message.create({
      data: { conversationId, sender: "user", type, content, productId, supplyChainId, status: "sent" },
      include: { supplyChain: { select: { id: true, name: true, orderNumber: true, status: true } } },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json(message);
  } catch (err) {
    console.error("[POST /api/crm/conversations]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
