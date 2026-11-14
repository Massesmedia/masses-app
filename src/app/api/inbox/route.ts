import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

  try {
    // Fetch all messages where you are either the sender OR the receiver
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderKey: key },
          { receiverKey: key }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET INBOX ERROR:", error);
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Create the message
    const message = await prisma.directMessage.create({
      data: {
        senderKey: body.senderKey,
        receiverKey: body.receiverKey,
        content: body.content,
        // We completely ignore postId so the database doesn't block it
      },
    });
    
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST INBOX ERROR:", error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}