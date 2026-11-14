import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') || 'new';
  const q = searchParams.get('q') || '';
  const ids = searchParams.get('ids');
  const authorKey = searchParams.get('authorKey');

  console.log("API HIT - AuthorKey:", authorKey);

  try {
    let posts;
    
    if (authorKey) {
      posts = await prisma.post.findMany({ 
        where: { authorKey: authorKey }, 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        orderBy: { createdAt: 'desc' } 
      });
    } 
    else if (ids) {
      const idArray = ids.split(',');
      posts = await prisma.post.findMany({ 
        where: { id: { in: idArray } }, 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        orderBy: { createdAt: 'desc' } 
      });
    } 
    else if (q) {
      posts = await prisma.post.findMany({ 
        where: { 
          OR: [
            { content: { contains: q, mode: 'insensitive' } }, 
            { displayName: { contains: q, mode: 'insensitive' } }
          ] 
        }, 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        orderBy: { createdAt: 'desc' }, 
        take: 50 
      });
    } 
    else {
      posts = await prisma.post.findMany({ 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        take: 50 
      });

      if (sort === 'hot') {
        posts.sort((a: any, b: any) => {
          const scoreA = (a.comments.length + 1) / Math.pow((Date.now() - new Date(a.createdAt).getTime()) / 3600000 + 2, 1.5);
          const scoreB = (b.comments.length + 1) / Math.pow((Date.now() - new Date(b.createdAt).getTime()) / 3600000 + 2, 1.5);
          return scoreB - scoreA;
        });
      } else {
        posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    }
    
    return NextResponse.json({ posts });
  } catch (error) { 
    return NextResponse.json({ error: 'Failed' }, { status: 500 }); 
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const post = await prisma.post.create({ 
      data: { 
        content: body.content || '', 
        displayName: body.display_name || 'Anonymous', 
        gifUrl: body.gif_url || null,
        authorKey: body.authorKey || null 
      } 
    });
    return NextResponse.json(post, { status: 201 });
  } catch (error) { 
    return NextResponse.json({ error: 'Failed' }, { status: 500 }); 
  }
}