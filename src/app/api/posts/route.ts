import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') || 'new';
  const q = searchParams.get('q') || '';
  const ids = searchParams.get('ids');
  const authorKey = searchParams.get('authorKey');

  try {
    let posts;
    
    // 1. Fetch by Author Key (for "My Posts" restored from other devices)
    if (authorKey) {
      posts = await prisma.post.findMany({ 
        where: { authorKey: authorKey }, 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        orderBy: { createdAt: 'desc' } 
      });
    } 
    // 2. Fetch specific IDs (for local storage My Posts)
    else if (ids) {
      const idArray = ids.split(',');
      posts = await prisma.post.findMany({ 
        where: { id: { in: idArray } }, 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        orderBy: { createdAt: 'desc' } 
      });
    } 
    // 3. Search Query (This handles the hashtag search)
    else if (q) {
      const cleanQuery = q.replace('#', ''); // Remove # so "life" searches for "life"
      posts = await prisma.post.findMany({ 
        where: { 
          OR: [
            { content: { contains: cleanQuery, mode: 'insensitive' } }, 
            { displayName: { contains: cleanQuery, mode: 'insensitive' } }
          ] 
        }, 
        include: { comments: { orderBy: { createdAt: 'asc' } } }, 
        orderBy: { createdAt: 'desc' }, 
        take: 50 
      });
    } 
    // 4. Default Feed (New or Hot)
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
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 }); 
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
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 }); 
  }
}

// PATCH: Calculate Trending Topics
export async function PATCH(request: Request) {
  try {
    // Get all posts from the last 48 hours to keep trends fresh
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    const posts = await prisma.post.findMany({
      where: { createdAt: { gte: twoDaysAgo } },
      include: { comments: true }
    });

    const tagCounts: { [key: string]: number } = {};

    posts.forEach(post => {
      // Find all words starting with #
      const tags = post.content.match(/#[a-zA-Z0-9_]+/g);
      if (tags) {
        tags.forEach(tag => {
          const cleanTag = tag.toLowerCase();
          // Weight the tag: 1 for the post + 1 for every reply it got
          const weight = 1 + post.comments.length;
          
          if (tagCounts[cleanTag]) {
            tagCounts[cleanTag] += weight;
          } else {
            tagCounts[cleanTag] = weight;
          }
        });
      }
    });

    // Convert to array, sort by weight, and take the top 6
    const trending = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return NextResponse.json({ trending });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to calculate trends' }, { status: 500 });
  }
}