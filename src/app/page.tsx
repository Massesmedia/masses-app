'use client';
import { useState, useEffect } from 'react';

type Comment = { id: string; displayName: string; content: string; gifUrl: string | null; createdAt: string };
type Post = { id: string; displayName: string; content: string; gifUrl: string | null; createdAt: string; comments: Comment[] };

const Logo = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#000000"/><g fill="#FFFFFF"><circle cx="512" cy="350" r="105"/>
    <path d="M300 760 V690 A212 212 0 0 1 724 690 V760 H620 V690 A108 108 0 0 0 404 690 V760 Z"/><circle cx="300" cy="390" r="80"/>
    <path d="M145 720 V680 A155 155 0 0 1 375 560 L415 590 A110 110 0 0 0 250 680 V720 Z"/><circle cx="724" cy="390" r="80"/>
    <path d="M609 590 L649 560 A155 155 0 0 1 879 680 V720 H774 V680 A110 110 0 0 0 609 590 Z"/><circle cx="145" cy="450" r="60"/>
    <path d="M28 680 V650 A117 117 0 0 1 175 545 L195 565 A85 85 0 0 0 118 650 V680 Z"/><circle cx="879" cy="450" r="60"/>
    <path d="M829 565 L849 545 A117 117 0 0 1 996 650 V680 H906 V650 A85 85 0 0 0 829 565 Z"/></g>
  </svg>
);

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sort, setSort] = useState<'new' | 'hot'>('new');
  const [tab, setTab] = useState<'feed' | 'search' | 'my-posts'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [replyTexts, setReplyTexts] = useState<{ [key: string]: string }>({});
  const [canPost, setCanPost] = useState(true);

  useEffect(() => { fetchPosts(); }, [sort, tab]);

  const fetchPosts = async () => {
    setIsLoading(true);
    let url = '/api/posts';
    if (tab === 'my-posts') {
      const ids = JSON.parse(localStorage.getItem('masses_my_posts') || '[]');
      if (ids.length === 0) { setPosts([]); setIsLoading(false); return; }
      url = `/api/posts?ids=${ids.join(',')}`;
    } else if (tab === 'search' && searchQuery) {
      url = `/api/posts?q=${encodeURIComponent(searchQuery)}`;
    } else {
      url = `/api/posts?sort=${sort}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    setPosts(data.posts || []);
    setIsLoading(false);
  };

  const submitPost = async () => {
    if (!content.trim()) return;
    setCanPost(false);
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, display_name: displayName }) });
    const newPost = await res.json();
    if (newPost.id) {
      const currentIds = JSON.parse(localStorage.getItem('masses_my_posts') || '[]');
      localStorage.setItem('masses_my_posts', JSON.stringify([...currentIds, newPost.id]));
    }
    setContent(''); setDisplayName(''); fetchPosts();
    setTimeout(() => setCanPost(true), 60000);
  };

  const toggleThread = (id: string) => {
    const newSet = new Set(openThreads);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setOpenThreads(newSet);
  };

  const submitReply = async (postId: string) => {
    const text = replyTexts[postId];
    if (!text?.trim()) return;
    await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, display_name: 'Anonymous' }) });
    setReplyTexts({ ...replyTexts, [postId]: '' });
    fetchPosts();
  };

  return (
    <div className="max-w-[600px] mx-auto min-h-screen border-x border-[#27272A] pb-20 bg-[#09090B] text-white">
      <header className="sticky top-0 bg-[#09090B]/95 backdrop-blur-md p-4 border-b border-[#27272A] flex justify-between items-center z-50">
        <div className="flex items-center gap-3"><Logo className="w-8 h-8 rounded-md" /><span className="text-xl font-extrabold tracking-widest uppercase">MASSES</span></div>
        <button onClick={() => setSort(sort === 'new' ? 'hot' : 'new')} className="text-xs font-semibold text-[#A1A1AA] border border-[#27272A] px-2 py-1 rounded">{sort === 'new' ? 'NEW' : 'HOT'}</button>
      </header>
      <div className="flex border-b border-[#27272A] bg-[#121214]">
        {(['feed', 'search', 'my-posts'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 p-3 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? 'text-white border-white' : 'text-[#A1A1AA] border-transparent'}`}>{t.replace('-', ' ')}</button>
        ))}
      </div>
      {tab === 'search' && <form onSubmit={(e) => { e.preventDefault(); fetchPosts(); }} className="p-4 border-b border-[#27272A]"><input type="text" placeholder="Search thoughts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-3 text-white outline-none" /></form>}
      {tab === 'feed' && (
        <div className="p-5 border-b border-[#27272A] bg-[#121214]">
          <input type="text" placeholder="Anonymous (Optional Name)" maxLength={28} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-transparent border-b border-[#27272A] pb-2 mb-2 text-xs text-[#A1A1AA] outline-none" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What is on your mind?" className="w-full bg-transparent outline-none resize-none text-lg text-white" rows={2} />
          <div className="flex justify-end mt-2"><button onClick={submitPost} disabled={!content.trim() || !canPost} className="bg-white text-black font-bold py-2 px-6 rounded-full disabled:opacity-30">{canPost ? 'Post' : 'Wait 60s'}</button></div>
        </div>
      )}
      <main>
        {isLoading ? <div className="p-5 space-y-4">{[1,2,3].map(i => <div key={i} className="animate-pulse border border-[#27272A] p-5 rounded-xl"><div className="h-3 w-24 bg-[#27272A] rounded mb-4"></div><div className="h-4 w-full bg-[#27272A] rounded mb-2"></div><div className="h-4 w-2/3 bg-[#27272A] rounded"></div></div>)}</div> 
        : posts.length === 0 ? <div className="flex flex-col items-center justify-center p-20 text-center"><Logo className="w-20 h-20 mb-6 opacity-80" /><p className="text-[#A1A1AA] text-sm">No thoughts found. Be the first voice.</p></div>
        : posts.map((post) => {
            const isOpen = openThreads.has(post.id);
            return (
              <div key={post.id} className="p-5 border-b border-[#27272A]">
                <div className="flex justify-between text-xs text-[#A1A1AA] mb-2"><span>{post.displayName} <span className="bg-[#27272A] px-1 rounded ml-1">ID:{post.id.slice(0,4)}</span></span><span>{new Date(post.createdAt).toLocaleDateString()}</span></div>
                <p className="text-lg mb-4 whitespace-pre-wrap">{post.content}</p>
                <button onClick={() => toggleThread(post.id)} className={`flex items-center gap-2 text-sm ${isOpen ? 'text-white' : 'text-[#A1A1AA]'}`}><span className={`text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>{post.comments.length} Replies</button>
                {isOpen && (
                  <div className="mt-4 pl-4 border-l border-[#27272A] space-y-4">
                    {post.comments.map(c => <div key={c.id} className="text-sm"><span className="text-xs text-[#A1A1AA] block mb-1">{c.displayName}</span>{c.content}</div>)}
                    <div className="flex gap-2 mt-2">
                      <input type="text" placeholder="Reply..." value={replyTexts[post.id] || ''} onChange={(e) => setReplyTexts({ ...replyTexts, [post.id]: e.target.value })} className="flex-1 bg-[#09090B] border border-[#27272A] rounded p-2 text-sm outline-none text-white" onKeyDown={(e) => e.key === 'Enter' && submitReply(post.id)} />
                      <button onClick={() => submitReply(post.id)} className="text-sm font-bold px-2">Reply</button>
                    </div>
                  </div>
                )}
              </div>
            );
        })}
      </main>
    </div>
  );
}
