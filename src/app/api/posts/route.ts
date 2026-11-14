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
    if (authorKey) {
      posts = await prisma.post.findMany({ where: { authorKey: authorKey }, include: { comments: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    } else if (ids) {
      const idArray = ids.split(',');
      posts = await prisma.post.findMany({ where: { id: { in: idArray } }, include: { comments: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    } else if (q) {
      posts = await prisma.post.findMany({ where: { OR: [{ content: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] }, include: { comments: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    } else {
      posts = await prisma.post.findMany({ include: { comments: { orderBy: { createdAt: 'asc' } } }, take: 50 });
      if (sort === 'hot') {
        posts.sort((a: any, b: any) => {
          const scoreA = (a.comments.length + 1) / Math.pow((Date.now() - new Date(a.createdAt).getTime()) / 3600000 + 2, 1.5);
          const scoreB = (b.comments.length + 1) / Math.pow((Date.now() - new Date(b.createdAt).getTime()) / 3600000 + 2, 1.5);
          return scoreB