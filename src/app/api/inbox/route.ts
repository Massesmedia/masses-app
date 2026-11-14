import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// GET: Fetch messages for a specific device key
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

  try {
    const messages = await prisma.directMessage.findMany({
      where: { receiverKey: key },
      orderBy: { createdAt: 'desc' },
    });
    // Also get the posts these messages belong to, so we can show context
    const postIds = messages.map(m => m.postId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } }
    });

    return NextResponse.json({ messages, posts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}

// POST: Send a new message
export async function POST(request: Request) {
  try {
    const body = await request.json();
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
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}