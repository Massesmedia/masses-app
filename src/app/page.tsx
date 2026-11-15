'use client';
import { useState, useEffect, useRef } from 'react';

type Comment = { id: string; displayName: string; content: string; gifUrl: string | null; createdAt: string };
type Post = { id: string; displayName: string; content: string; gifUrl: string | null; authorKey: string | null; createdAt: string; comments: Comment[] };
type DirectMessage = { id: string; senderKey: string; receiverKey: string; content: string; createdAt: string };
type ProfileData = { name: string; posts: Post[]; replies: Comment[]; authorKey: string };

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

const getAvatarGradient = (name: string) => {
  const colors = ['from-[#FF416C] to-[#FF4B2B]', 'from-[#00B4DB] to-[#0083B0]', 'from-[#8E2DE2] to-[#4A00E0]', 'from-[#11998e] to-[#38ef7d]', 'from-[#FC5C7D] to-[#6A82FB]', 'from-[#F2994A] to-[#F2C94C]', 'from-[#8B5CF6] to-[#DB2777]'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sort, setSort] = useState<'new' | 'hot'>('new');
  const [tab, setTabState] = useState<'feed' | 'search' | 'my-posts' | 'inbox'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [replyTexts, setReplyTexts] = useState<{ [key: string]: string }>({});
  const [canPost, setCanPost] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [inboxMessages, setInboxMessages] = useState<DirectMessage[]>([]);
  const [dmTexts, setDmTexts] = useState<{ [key: string]: string }>({});
  
  const [viewingProfile, setViewingProfile] = useState<ProfileData | null>(null);
  const [profileTab, setProfileTab] = useState<'echoes' | 'whispers'>('echoes');
  const [dmTarget, setDmTarget] = useState<ProfileData | null>(null);
  const [trendingTags, setTrendingTags] = useState<{tag: string, count: number}[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let key = localStorage.getItem('masses_device_key');
    if (!key) {
      key = 'rk_' + crypto.randomUUID();
      localStorage.setItem('masses_device_key', key);
    }
    setDeviceKey(key);
    const savedTab = localStorage.getItem('masses_current_tab');
    if (savedTab) setTabState(savedTab as any);

    const fetchTrends = async () => {
      const res = await fetch('/api/posts', { method: 'PATCH' });
      const data = await res.json();
      if (data.trending) setTrendingTags(data.trending);
    };
    fetchTrends();
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanPost(true);
    }
  }, [cooldown]);

  useEffect(() => {
    if (tab === 'inbox' && inboxMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [inboxMessages, tab]);

  const setTab = (newTab: 'feed' | 'search' | 'my-posts' | 'inbox') => {
    setTabState(newTab);
    setViewingProfile(null);
    localStorage.setItem('masses_current_tab', newTab);
  };

  useEffect(() => { 
    if (deviceKey && !viewingProfile) {
      if (tab === 'inbox') fetchInbox();
      else fetchPosts(); 
    }
  }, [sort, tab, searchQuery, deviceKey, viewingProfile]);

  const fetchPosts = async () => {
    setIsLoading(true);
    let url = '/api/posts';
    if (tab === 'my-posts') url = `/api/posts?authorKey=${deviceKey}`;
    else if (tab === 'search' && searchQuery) url = `/api/posts?q=${encodeURIComponent(searchQuery)}`;
    else url = `/api/posts?sort=${sort}`;
    const res = await fetch(url);
    const data = await res.json();
    setPosts(data.posts || []);
    setIsLoading(false);
  };

  const fetchInbox = async () => {
    setIsLoading(true);
    const res = await fetch(`/api/inbox?key=${deviceKey}`);
    const data = await res.json();
    setInboxMessages(data.messages || []);
    setIsLoading(false);
  };

  const openProfile = (name: string, authorKey: string) => {
    const userPosts = posts.filter(p => p.displayName === name);
    const userReplies: Comment[] = [];
    posts.forEach(p => {
      p.comments.forEach(c => {
        if (c.displayName === name) userReplies.push(c);
      });
    });
    const isMe = userPosts.some(p => p.authorKey === deviceKey) || authorKey === deviceKey;
    setViewingProfile({ name, posts: userPosts, replies: userReplies, authorKey: isMe ? (deviceKey || 'me') : authorKey });
    setProfileTab('echoes');
  };

  const submitPost = async () => {
    if (!content.trim() || !canPost) return;
    setCanPost(false);
    setCooldown(60);
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, display_name: displayName, authorKey: deviceKey }) });
    if (res.ok) {
      const newPost = await res.json();
      if (newPost.id) {
        const currentIds = JSON.parse(localStorage.getItem('masses_my_posts') || '[]');
        localStorage.setItem('masses_my_posts', JSON.stringify([...currentIds, newPost.id]));
      }
      setContent(''); setDisplayName(''); setIsComposerOpen(false); 
      fetchPosts();
    } else {
      alert("Failed to post. Try again.");
      setCanPost(true);
      setCooldown(0);
    }
  };

  const sendDM = async () => {
    if (!dmTarget || !dmTexts[dmTarget.name]?.trim()) return;
    const res = await fetch('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderKey: deviceKey, receiverKey: dmTarget.authorKey, content: dmTexts[dmTarget.name] }) });
    if (!res.ok) { alert("Failed to send."); return; }
    setDmTexts({ ...dmTexts, [dmTarget.name]: '' });
    setDmTarget(null);
    alert("Whisper sent! Check your Inbox.");
  };

  const submitReply = async (postId: string) => {
    const text = replyTexts[postId];
    if (!text?.trim()) return;
    await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, display_name: 'Anonymous' }) });
    setReplyTexts({ ...replyTexts, [postId]: '' });
    fetchPosts();
  };

  const toggleThread = (id: string) => {
    const newSet = new Set(openThreads);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setOpenThreads(newSet);
  };

  const restoreKey = () => {
    const input = prompt("Paste your Secret Recovery Key here:");
    if (input) {
      const cleanKey = input.trim();
      // Accept both dk_ and rk_ formats
      if (cleanKey.startsWith('dk_') || cleanKey.startsWith('rk_')) {
        localStorage.setItem('masses_device_key', cleanKey);
        window.location.reload(); 
      } else { 
        alert("Invalid key format."); 
      }
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="max-w-[600px] mx-auto min-h-screen pb-24 bg-[#08090D] text-[#F4F4F7] font-sans selection:bg-[#8B5CF6]/30">
      
      <header className="sticky top-0 bg-[#08090D]/90 backdrop-blur-xl border-b border-[#242632] p-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-3">
          {viewingProfile ? (
            <button onClick={() => setViewingProfile(null)} className="text-[#9CA3AF] hover:text-white flex items-center gap-2 font-semibold">
              ← Back
            </button>
          ) : (
            <>
              <button onClick={() => setIsMenuOpen(true)} className="text-[#9CA3AF] hover:text-white p-2 -ml-2">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              </button>
              <Logo className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-black tracking-widest text-white">MASSES</span>
            </>
          )}
        </div>
        {tab === 'feed' && !viewingProfile && (
          <button onClick={() => setSort(sort === 'new' ? 'hot' : 'new')} className="text-xs font-semibold text-[#9CA3AF] flex items-center gap-1">
            {sort === 'new' ? 'New' : 'Hot'} <span className="text-[10px]">▼</span>
          </button>
        )}
      </header>

      <main>  {viewingProfile ? (
    <div className="pb-10 relative">
      {viewingProfile.authorKey !== deviceKey && viewingProfile.authorKey !== 'me' && (
        <button onClick={() => setDmTarget(viewingProfile)} className="absolute top-4 right-4 p-3 bg-[#14151C] border border-[#242632] rounded-full hover:border-[#8B5CF6] transition-all z-10">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#9CA3AF] hover:text-[#8B5CF6]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </button>
      )}

      <div className="p-6 border-b border-[#242632] flex flex-col items-center bg-[#14151C]/50 pt-10">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-4xl text-white bg-gradient-to-br ${getAvatarGradient(viewingProfile.name)} mb-4 shadow-lg`}>
          {viewingProfile.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{viewingProfile.name}</h2>
        <p className="text-xs text-[#9CA3AF] mb-4">Anonymous Identity</p>
        
        {(viewingProfile.authorKey === deviceKey || viewingProfile.authorKey === 'me') && (
          <span className="px-4 py-1 bg-[#242632] text-[#9CA3AF] text-xs font-bold rounded-full">This is You</span>
        )}
      </div>

      <div className="flex border-b border-[#242632]">
        <button onClick={() => setProfileTab('echoes')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${profileTab === 'echoes' ? 'text-[#8B5CF6] border-[#8B5CF6]' : 'text-[#9CA3AF] border-transparent'}`}>Echoes ({viewingProfile.posts.length})</button>
        <button onClick={() => setProfileTab('whispers')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${profileTab === 'whispers' ? 'text-[#8B5CF6] border-[#8B5CF6]' : 'text-[#9CA3AF] border-transparent'}`}>Whispers ({viewingProfile.replies.length})</button>
      </div>

      <div className="p-4 space-y-4">
        {profileTab === 'echoes' && (
          viewingProfile.posts.length === 0 ? <p className="text-center text-[#9CA3AF] mt-10">No Echoes yet.</p> :
          viewingProfile.posts.map(p => (
            <div key={p.id} className="p-4 bg-[#14151C] border border-[#242632] rounded-xl">
              <p className="text-[15px] mb-2 text-[#F4F4F7]">{p.content}</p>
              <span className="text-xs text-[#9CA3AF]">{timeAgo(p.createdAt)}</span>
            </div>
          ))
        )}
        {profileTab === 'whispers' && (
          viewingProfile.replies.length === 0 ? <p className="text-center text-[#9CA3AF] mt-10">No Whispers yet.</p> :
          viewingProfile.replies.map((r, i) => (
            <div key={i} className="p-4 bg-[#14151C] border border-[#242632] rounded-xl">
              <p className="text-[15px] mb-2 text-[#F4F4F7]">"{r.content}"</p>
              <span className="text-xs text-[#9CA3AF]">{timeAgo(r.createdAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>

  ) : isLoading ? (
    <div className="p-5 space-y-4">{[1,2,3].map(i => <div key={i} className="animate-pulse border border-[#242632] p-5 rounded-xl bg-[#14151C]"><div className="h-3 w-24 bg-[#242632] rounded mb-4"></div><div className="h-4 w-full bg-[#242632] rounded mb-2"></div><div className="h-4 w-2/3 bg-[#242632] rounded"></div></div>)}</div> 
  )

  : tab === 'search' ? (
    <div className="p-4 space-y-6">
      <div className="relative">
        <input type="text" placeholder="Search Echoes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#14151C] border border-[#242632] rounded-xl p-4 pl-12 text-white outline-none focus:border-[#8B5CF6] transition-all" />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 absolute left-4 top-4 text-[#9CA3AF]"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#F4F4F7] mb-3">Trending Topics</h3>
        <div className="flex flex-wrap gap-2">
          {trendingTags.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">No trends yet. Start a hashtag!</p>
          ) : (
            trendingTags.map(t => (
              <button 
                key={t.tag} 
                onClick={() => setSearchQuery(t.tag)} 
                className="px-4 py-2 bg-[#14151C] border border-[#242632] rounded-full text-sm text-[#9CA3AF] hover:text-white hover:border-[#8B5CF6] transition-all flex items-center gap-2"
              >
                {t.tag}
                <span className="text-[10px] bg-[#242632] px-2 py-0.5 rounded-full">{t.count}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <button 
        onClick={() => {
          setSearchQuery(''); 
          setSort('hot');     
          setTab('feed');     
        }} 
        className="w-full text-left mt-8 p-6 bg-gradient-to-br from-[#8B5CF6] to-[#DB2777] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all"
      >
        <h2 className="text-xl font-bold text-white mb-2">Search. Discover. Explore.</h2>
        <p className="text-white/80 text-sm">Find what the masses are saying.</p>
      </button>

      {posts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[#F4F4F7] mb-3">Results</h3>
          {posts.map(post => (
            <div key={post.id} className="p-4 bg-[#14151C] border border-[#242632] rounded-xl mb-3">
              <p className="text-[15px] text-[#F4F4F7]">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>

  ) : tab === 'inbox' ? (
    <div className="p-4 flex flex-col space-y-4 pb-20">
      <div className="flex flex-col space-y-4">
        {inboxMessages.length === 0 ? (
          <div className="text-center text-[#9CA3AF] mt-10">No Whispers yet.</div>
        ) : (
          inboxMessages.slice().reverse().map(msg => {
            const isMe = msg.senderKey === deviceKey;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-[#9CA3AF] mb-1 px-1">{isMe ? 'You' : 'Anonymous'}</span>
                
                <div className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-gradient-to-br from-[#8B5CF6] to-[#DB2777] text-white rounded-br-sm' : 'bg-[#14151C] border border-[#242632] text-[#F4F4F7] rounded-bl-sm'}`}>
                  <p className="text-[15px]">{msg.content}</p>
                </div>
                
                <span className="text-[10px] text-[#9CA3AF] mt-1 px-1">{timeAgo(msg.createdAt)}</span>
              </div>
            )
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {inboxMessages.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 max-w-[600px] mx-auto p-3 bg-[#08090D]/95 backdrop-blur-xl border-t border-[#242632]">
          <div className="flex gap-2">
            <input type="text" placeholder="Reply to whisper..." onChange={(e) => setDmTexts({...dmTexts, 'reply': e.target.value})} className="flex-1 bg-[#14151C] border border-[#242632] rounded-full px-4 py-2 text-sm text-white outline-none focus:border-[#8B5CF6]" />
            <button onClick={() => {
               const lastMsg = inboxMessages[0];
               if (dmTexts['reply']?.trim() && lastMsg) {
                 fetch('/api/inbox', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ senderKey: deviceKey, receiverKey: lastMsg.senderKey === deviceKey ? lastMsg.receiverKey : lastMsg.senderKey, content: dmTexts['reply'] })});
                 setDmTexts({...dmTexts, 'reply': ''});
                 setTimeout(fetchInbox, 1000);
               }
            }} className="text-sm font-bold bg-[#8B5CF6] text-white px-4 rounded-full">Send</button>
          </div>
        </div>
      )}
    </div>

  ) : posts.length === 0 ? (
    <div className="flex flex-col items-center justify-center p-20 text-center mt-10"><Logo className="w-20 h-20 mb-6 opacity-20" /><p className="text-[#9CA3AF] text-sm">No Echoes yet. Be the first voice.</p></div>
  )
  
  : posts.map((post) => {
      const isOpen = openThreads.has(post.id);
      const avatarGradient = getAvatarGradient(post.displayName);
      const initial = post.displayName.charAt(0).toUpperCase();

      return (
        <div key={post.id} className="p-4 border-b border-[#242632] hover:bg-[#14151C]/40 transition-colors flex gap-3">
          <div onClick={() => openProfile(post.displayName, post.authorKey || 'unknown')} className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg text-white bg-gradient-to-br ${avatarGradient} cursor-pointer hover:opacity-80`}>
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <div onClick={() => openProfile(post.displayName, post.authorKey || 'unknown')} className="flex justify-between text-[13px] text-[#9CA3AF] mb-1 font-medium items-center cursor-pointer hover:text-white">
              <span className="truncate flex items-center gap-2">
                {post.displayName} <span className="text-[10px] opacity-70">• {timeAgo(post.createdAt)}</span>
              </span>
            </div>

            <p className="text-[16px] mb-4 whitespace-pre-wrap leading-relaxed text-[#F4F4F7]">{post.content}</p>
            
            <div className="flex items-center justify-between">
              <button onClick={() => toggleThread(post.id)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isOpen ? 'text-[#8B5CF6]' : 'text-[#9CA3AF] hover:text-[#8B5CF6]'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                {post.comments.length} Whispers
              </button>
            </div>

            {isOpen && (
              <div className="mt-4 space-y-3 pl-4 border-l-2 border-[#242632]">
                {post.comments.map(c => {
                  const cGradient = getAvatarGradient(c.displayName);
                  return (
                  <div key={c.id} className="flex gap-2">
                    <div onClick={() => openProfile(c.displayName, 'unknown')} className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs text-white bg-gradient-to-br ${cGradient} cursor-pointer`}>
                      {c.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <span onClick={() => openProfile(c.displayName, 'unknown')} className="text-xs text-[#9CA3AF] block mb-1 font-semibold cursor-pointer hover:text-white">{c.displayName}</span>
                      <span className="text-[14px] text-[#F4F4F7]">{c.content}</span>
                    </div>
                  </div>
                )})}
                <div className="flex gap-2 mt-3 pl-9">
                  <input type="text" placeholder="Whisper publicly..." value={replyTexts[post.id] || ''} onChange={(e) => setReplyTexts({ ...replyTexts, [post.id]: e.target.value })} className="flex-1 bg-[#14151C] border border-[#242632] rounded-xl p-3 text-sm outline-none focus:border-[#8B5CF6] transition-all text-white placeholder-[#9CA3AF]" onKeyDown={(e) => e.key === 'Enter' && submitReply(post.id)} />
                  <button onClick={() => submitReply(post.id)} className="text-sm font-bold px-3 text-[#8B5CF6] hover:text-white transition-colors">Reply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
  })}
</main>      {tab === 'feed' && !viewingProfile && (
        <button onClick={() => setIsComposerOpen(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-[#8B5CF6] to-[#DB2777] rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95 transition-transform z-40">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </button>
      )}

      {dmTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDmTarget(null)}>
          <div className="w-full max-w-[400px] bg-[#14151C] border border-[#242632] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-1">Message {dmTarget.name}</h3>
            <p className="text-xs text-[#9CA3AF] mb-4">This will be sent privately to their Inbox.</p>
            <input type="text" placeholder="Type your whisper..." value={dmTexts[dmTarget.name] || ''} onChange={(e) => setDmTexts({...dmTexts, [dmTarget.name]: e.target.value})} className="w-full bg-[#08090D] border border-[#242632] rounded-xl p-3 text-sm text-white outline-none focus:border-[#8B5CF6] mb-4" autoFocus />
            <div className="flex justify-end gap-3">
              <button onClick={() => setDmTarget(null)} className="text-sm text-[#9CA3AF]">Cancel</button>
              <button onClick={sendDM} className="text-sm font-bold bg-gradient-to-r from-[#8B5CF6] to-[#DB2777] text-white px-4 py-2 rounded-lg">Send</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-[600px] mx-auto bg-[#08090D]/95 backdrop-blur-xl border-t border-[#242632] flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => setTab('feed')} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${tab === 'feed' ? 'text-[#8B5CF6]' : 'text-[#9CA3AF] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
          <span className="text-[10px] font-semibold">Echoes</span>
        </button>
        <button onClick={() => setTab('search')} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${tab === 'search' ? 'text-[#8B5CF6]' : 'text-[#9CA3AF] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <span className="text-[10px] font-semibold">Explore</span>
        </button>
        <button onClick={() => setTab('my-posts')} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${tab === 'my-posts' ? 'text-[#8B5CF6]' : 'text-[#9CA3AF] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <span className="text-[10px] font-semibold">My Echoes</span>
        </button>
        <button onClick={() => setTab('inbox')} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${tab === 'inbox' ? 'text-[#8B5CF6]' : 'text-[#9CA3AF] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
          <span className="text-[10px] font-semibold">Whispers</span>
        </button>
      </nav>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative w-72 h-full bg-[#14151C] border-r border-[#242632] shadow-2xl p-6 animate-[slideRight_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
               <span className="font-black text-xl text-white tracking-widest">MASSES</span>
               <button onClick={() => setIsMenuOpen(false)} className="text-[#9CA3AF] hover:text-white">✕</button>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-[#08090D] rounded-xl border border-[#242632]">
                <p className="text-xs text-[#9CA3AF] mb-2 font-semibold">Secret Recovery Key</p>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-[#8B5CF6] break-all block flex-1">{deviceKey}</code>
                  <button onClick={() => { if (deviceKey) { navigator.clipboard.writeText(deviceKey); alert("Key copied!"); } }} className="p-2 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg hover:bg-[#8B5CF6]/20 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                  </button>
                </div>
              </div>
              <button onClick={restoreKey} className="w-full py-3 bg-gradient-to-r from-[#8B5CF6]/20 to-[#DB2777]/20 text-white border border-[#8B5CF6]/30 rounded-xl font-semibold hover:bg-[#8B5CF6]/30 transition-all">Restore from Key</button>
            </div>
          </div>
        </div>
      )}

      {isComposerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsComposerOpen(false)}>
          <div className="w-full max-w-[600px] bg-[#14151C] border-t border-[#242632] rounded-t-3xl p-6 shadow-2xl animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-white">New Echo</span>
              <button onClick={() => setIsComposerOpen(false)} className="text-[#9CA3AF] hover:text-white">✕</button>
            </div>
            <input type="text" placeholder="Anonymous (Optional Name)" maxLength={28} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-transparent border-b border-[#242632] pb-3 mb-4 text-sm text-[#9CA3AF] outline-none focus:border-[#8B5CF6]" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={600} placeholder="What is on your mind?" className="w-full bg-transparent outline-none resize-none text-lg text-white placeholder-[#9CA3AF]" rows={4} autoFocus />
            <div className="flex justify-between items-center mt-6">
              <span className={`text-xs ${content.length > 550 ? 'text-[#F59E0B]' : 'text-[#9CA3AF]'}`}>{content.length}/600</span>
              <button onClick={submitPost} disabled={!content.trim() || !canPost} className="bg-gradient-to-r from-[#8B5CF6] to-[#DB2777] text-white font-bold py-2.5 px-8 rounded-full disabled:opacity-50 hover:opacity-90 transition-opacity">
                {canPost ? 'Post' : `Wait ${cooldown}s`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}