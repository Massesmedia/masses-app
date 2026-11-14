import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

  try {
    // 1. Get messages where I am the receiver (Inbox)
    const received = await prisma.directMessage.findMany({
      where: { receiverKey: key },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Get messages where I am the sender (Sent)
    const sent = await prisma.directMessage.findMany({
      where: { senderKey: key },
      orderBy: { createdAt: 'desc' },
    });

    // Combine them so the user sees the full conversation
    const allMessages = [...received, ...sent].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ messages: allMessages });
  } catch (error) {
    console.error("INBOX API ERROR:", error);
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // We generate a real UUID for the message so it links properly
    const message = await prisma.directMessage.create({
      data: {
        postId: body.postId,
        senderKey: body.senderKey,
        receiverKey: body.receiverKey,
        content: body.content,
      },
    });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("INBOX POST ERROR:", error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}