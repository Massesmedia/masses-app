import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const comments = await prisma.comment.findMany({ where: { postId: params.id }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ comments });
  } catch (error) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const comment = await prisma.comment.create({ data: { postId: params.id, content: body.content || '', displayName: body.display_name || 'Anonymous', gifUrl: body.gif_url || null } });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
