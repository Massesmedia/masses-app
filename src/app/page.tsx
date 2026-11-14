'use client';
import { useState, useEffect } from 'react';

type Comment = { id: string; displayName: string; content: string; gifUrl: string | null; createdAt: string };
type Post = { id: string; displayName: string; content: string; gifUrl: string | null; authorKey: string | null; createdAt: string; comments: Comment[] };
type DirectMessage = { id: string; postId: string | null; senderKey: string; receiverKey: string; content: string; createdAt: string };
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
  const colors = ['from-[#FF416C] to-[#FF4B2B]', 'from-[#00B4DB] to-[#0083B0]', 'from-[#8E2DE2] to-[#4A00E0]', 'from-[#11998e] to-[#38ef7d]', 'from-[#FC5C7D] to-[#6A82FB]', 'from-[#F2994A] to-[#F2C94C]', 'from-[#7C3AED] to-[#DB2777]'];
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [inboxMessages, setInboxMessages] = useState<DirectMessage[]>([]);
  const [dmTexts, setDmTexts] = useState<{ [key: string]: string }>({});
  
  const [viewingProfile, setViewingProfile] = useState<ProfileData | null>(null);
  const [profileTab, setProfileTab] = useState<'echoes' | 'whispers'>('echoes');
  const [dmTarget, setDmTarget] = useState<ProfileData | null>(null);

  useEffect(() => {
    let key = localStorage.getItem('masses_device_key');
    if (!key) {
      key = 'dk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('masses_device_key', key);
    }
    setDeviceKey(key);
    const savedTab = localStorage.getItem('masses_current_tab');
    if (savedTab) setTabState(savedTab as any);
  }, []);

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
    if (!content.trim()) return;
    setCanPost(false);
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, display_name: displayName, authorKey: deviceKey }) });
    const newPost = await res.json();
    if (newPost.id) {
      const currentIds = JSON.parse(localStorage.getItem('masses_my_posts') || '[]');
      localStorage.setItem('masses_my_posts', JSON.stringify([...currentIds, newPost.id]));
    }
    setContent(''); setDisplayName(''); setIsComposerOpen(false); 
    fetchPosts();
    setTimeout(() => setCanPost(true), 60000);
  };

  const sendDM = async () => {
    if (!dmTarget || !dmTexts[dmTarget.name]?.trim()) return;
    
    await fetch('/api/inbox', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        postId: null, 
        senderKey: deviceKey, 
        receiverKey: dmTarget.authorKey, 
        content: dmTexts[dmTarget.name] 
      }) 
    });
    
    setDmTexts({ ...dmTexts, [dmTarget.name]: '' });
    setDmTarget(null);
    alert("Whisper sent privately! Check your Inbox tab.");
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
      if (cleanKey.startsWith('dk_')) {
        localStorage.setItem('masses_device_key', cleanKey);
        window.location.reload(); 
      } else { alert("Invalid key format."); }
    }
  };

  return (
    <div className="max-w-[600px] mx-auto min-h-screen border-x border-[#27272A] pb-20 bg-[#050505] text-[#F4F4F5] font-sans relative" style={{ background: 'radial-gradient(circle at top, #111 0%, #050505 40%)' }}>
      
      <header className="sticky top-0 bg-[#050505]/80 backdrop-blur-xl border-b border-[#27272A] p-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-3">
          {viewingProfile ? (
            <button onClick={() => setViewingProfile(null)} className="text-[#A1A1AA] hover:text-white flex items-center gap-2 font-bold">
              ← Back
            </button>
          ) : (
            <>
              <button onClick={() => setIsMenuOpen(true)} className="text-[#A1A1AA] hover:text-white p-2 -ml-2">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              </button>
              <div className="relative">
                <Logo className="w-8 h-8 rounded-[10px] relative z-10" />
                <div className="absolute inset-0 bg-[#7C3AED] blur-md opacity-20 rounded-[10px] z-0"></div>
              </div>
              <span className="text-xl font-black tracking-[0.15em] bg-clip-text text-transparent bg-gradient-to-br from-[#7C3AED] to-[#DB2777]">Masses</span>
            </>
          )}
        </div>
        {tab === 'feed' && !viewingProfile && (
          <button onClick={() => setSort(sort === 'new' ? 'hot' : 'new')} className="text-xs font-semibold text-[#A1A1AA] border border-[#27272A] bg-[#121214] px-3 py-1.5 rounded-lg hover:text-white transition-colors">{sort === 'new' ? 'NEW' : 'HOT'}</button>
        )}
      </header>

      {tab === 'search' && !viewingProfile && (
        <div className="p-4 border-b border-[#27272A]">
          <input type="text" placeholder="Search echoes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#121214] border border-[#27272A] rounded-xl p-3 text-white outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all" />
        </div>
      )}

      <main>  {viewingProfile ? (
    <div className="pb-10 relative">
      {viewingProfile.authorKey !== deviceKey && viewingProfile.authorKey !== 'me' && (
        <button onClick={() => setDmTarget(viewingProfile)} className="absolute top-4 right-4 p-3 bg-[#121214] border border-[#27272A] rounded-full hover:bg-[#7C3AED]/20 hover:border-[#7C3AED] transition-all z-10">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#A1A1AA] hover:text-[#7C3AED]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </button>
      )}

      <div className="p-6 border-b border-[#27272A] flex flex-col items-center bg-[#121214]/50 pt-10">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-4xl text-white bg-gradient-to-br ${getAvatarGradient(viewingProfile.name)} mb-4 shadow-lg`}>
          {viewingProfile.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{viewingProfile.name}</h2>
        <p className="text-xs text-[#A1A1AA] mb-4">Anonymous Identity</p>
        
        {(viewingProfile.authorKey === deviceKey || viewingProfile.authorKey === 'me') && (
          <span className="px-4 py-1 bg-[#27272A] text-[#A1A1AA] text-xs font-bold rounded-full">This is You</span>
        )}
      </div>

      <div className="flex border-b border-[#27272A] bg-[#050505]">
        <button onClick={() => setProfileTab('echoes')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${profileTab === 'echoes' ? 'text-[#7C3AED] border-[#7C3AED]' : 'text-[#A1A1AA] border-transparent'}`}>Echoes ({viewingProfile.posts.length})</button>
        <button onClick={() => setProfileTab('whispers')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${profileTab === 'whispers' ? 'text-[#7C3AED] border-[#7C3AED]' : 'text-[#A1A1AA] border-transparent'}`}>Whispers ({viewingProfile.replies.length})</button>
      </div>

      <div className="p-4 space-y-4">
        {profileTab === 'echoes' && (
          viewingProfile.posts.length === 0 ? <p className="text-center text-[#A1A1AA] mt-10">No Echoes yet.</p> :
          viewingProfile.posts.map(p => (
            <div key={p.id} className="p-4 bg-[#121214] border border-[#27272A] rounded-xl">
              <p className="text-[15px] mb-2">{p.content}</p>
              <span className="text-xs text-[#A1A1AA]">{new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
          ))
        )}
        {profileTab === 'whispers' && (
          viewingProfile.replies.length === 0 ? <p className="text-center text-[#A1A1AA] mt-10">No Whispers yet.</p> :
          viewingProfile.replies.map((r, i) => (
            <div key={i} className="p-4 bg-[#121214] border border-[#27272A] rounded-xl">
              <p className="text-[15px] mb-2">"{r.content}"</p>
              <span className="text-xs text-[#A1A1AA]">{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          ))
        )}
      </div>
    </div>

  ) : isLoading ? (
    <div className="p-5 space-y-4">{[1,2,3].map(i => <div key={i} className="animate-pulse border border-[#27272A] p-5 rounded-xl"><div className="h-3 w-24 bg-[#27272A] rounded mb-4"></div><div className="h-4 w-full bg-[#27272A] rounded mb-2"></div><div className="h-4 w-2/3 bg-[#27272A] rounded"></div></div>)}</div> 
  )
  
  : tab === 'inbox' ? (
    <div className="p-4 space-y-4">
      {inboxMessages.length === 0 ? (
        <div className="text-center text-[#A1A1AA] mt-10">Your Whisper Inbox is empty.</div>
      ) : (
        inboxMessages.map((msg) => {
          const isMe = msg.senderKey === deviceKey;
          return (
            <div key={msg.id} className={`border p-4 rounded-xl ${isMe ? 'bg-[#1A1A1D] border-[#27272A] ml-8' : 'bg-[#121214] border-[#7C3AED]/30 mr-8'}`}>
              <div className="text-xs text-[#A1A1AA] mb-2 flex justify-between">
                <span>{isMe ? 'You whispered' : 'Whisper received'}</span>
              </div>
              <p className="text-sm text-white mb-2">{msg.content}</p>
              
              <div className="flex gap-2 mt-2">
                <input type="text" placeholder="Reply..." onChange={(e) => setDmTexts({...dmTexts, [msg.id]: e.target.value})} className="flex-1 bg-[#050505] border border-[#27272A] rounded-lg p-2 text-sm text-white outline-none focus:border-[#7C3AED]" />
                <button onClick={() => {
                   fetch('/api/inbox', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ postId: null, senderKey: deviceKey, receiverKey: isMe ? msg.receiverKey : msg.senderKey, content: dmTexts[msg.id] })});
                   setDmTexts({...dmTexts, [msg.id]: ''});
                   setTimeout(fetchInbox, 500);
                }} className="text-[#7C3AED] font-bold text-sm px-2">Send</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  )

  : posts.length === 0 ? <div className="flex flex-col items-center justify-center p-20 text-center mt-10"><Logo className="w-20 h-20 mb-6 opacity-50" /><p className="text-[#A1A1AA] text-sm">No echoes found. Be the first voice.</p></div>
  
  : posts.map((post) => {
      const isOpen = openThreads.has(post.id);
      const avatarGradient = getAvatarGradient(post.displayName);
      const initial = post.displayName.charAt(0).toUpperCase();

      return (
        <div key={post.id} className="p-4 border-b border-[#27272A] hover:bg-[#121214]/40 transition-colors flex gap-3">
          <div onClick={() => openProfile(post.displayName, post.authorKey || 'unknown')} className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg text-white bg-gradient-to-br ${avatarGradient} cursor-pointer hover:opacity-80`}>
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <div onClick={() => openProfile(post.displayName, post.authorKey || 'unknown')} className="flex justify-between text-[13px] text-[#A1A1AA] mb-1 font-medium items-center cursor-pointer hover:text-white">
              <span className="truncate">
                {post.displayName} <span className="text-[11px] ml-1 opacity-70">ID:{post.id.slice(0,4)}</span>
              </span>
              <span className="flex-shrink-0 ml-2">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>

            <p className="text-[16px] mb-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            
            <div className="flex items-center justify-between">
              <button onClick={() => toggleThread(post.id)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isOpen ? 'text-[#7C3AED]' : 'text-[#A1A1AA] hover:text-[#7C3AED]'}`}>
                <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                {post.comments.length} Whispers
              </button>
            </div>

            {isOpen && (
              <div className="mt-4 space-y-3">
                {post.comments.map(c => {
                  const cGradient = getAvatarGradient(c.displayName);
                  return (
                  <div key={c.id} className="flex gap-2">
                    <div onClick={() => openProfile(c.displayName, 'unknown')} className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs text-white bg-gradient-to-br ${cGradient} cursor-pointer`}>
                      {c.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 bg-[#121214] p-2 rounded-xl border border-[#27272A]">
                      <span onClick={() => openProfile(c.displayName, 'unknown')} className="text-xs text-[#A1A1AA] block mb-1 font-semibold cursor-pointer hover:text-white">{c.displayName}</span>
                      <span className="text-[14px]">{c.content}</span>
                    </div>
                  </div>
                )})}
                <div className="flex gap-2 mt-3 pl-9">
                  <input type="text" placeholder="Whisper publicly..." value={replyTexts[post.id] || ''} onChange={(e) => setReplyTexts({ ...replyTexts, [post.id]: e.target.value })} className="flex-1 bg-[#050505] border border-[#27272A] rounded-xl p-3 text-sm outline-none focus:border-[#7C3AED] transition-all text-white" onKeyDown={(e) => e.key === 'Enter' && submitReply(post.id)} />
                  <button onClick={() => submitReply(post.id)} className="text-sm font-bold px-3 text-[#7C3AED] hover:text-[#9d6bff]">Reply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
  })}
</main>

{tab === 'feed' && !viewingProfile && (
  <button onClick={() => setIsComposerOpen(true)} className="fixed bottom-20 right-6 w-14 h-14 bg-gradient-to-r from-[#7C3AED] to-[#DB2777] rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(124,58,237,0.4)] hover:scale-105 active:scale-95 transition-transform z-40">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
  </button>
)}

{dmTarget && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDmTarget(null)}>
    <div className="w-full max-w-[400px] bg-[#121214] border border-[#27272A] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
      <h3 className="text-white font-bold mb-1">Message {dmTarget.name}</h3>
      <p className="text-xs text-[#A1A1AA] mb-4">This will be sent privately to their Inbox.</p>
      <input type="text" placeholder="Type your whisper..." value={dmTexts[dmTarget.name] || ''} onChange={(e) => setDmTexts({...dmTexts, [dmTarget.name]: e.target.value})} className="w-full bg-[#050505] border border-[#27272A] rounded-xl p-3 text-sm text-white outline-none focus:border-[#7C3AED] mb-4" autoFocus />
      <div className="flex justify-end gap-3">
        <button onClick={() => setDmTarget(null)} className="text-sm text-[#A1A1AA]">Cancel</button>
        <button onClick={sendDM} className="text-sm font-bold bg-[#7C3AED] text-white px-4 py-2 rounded-lg">Send</button>
      </div>
    </div>
  </div>
)}      <nav className="fixed bottom-0 left-0 right-0 max-w-[600px] mx-auto bg-[#050505]/95 backdrop-blur-xl border-t border-[#27272A] flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => setTab('feed')} className={`flex flex-col items-center justify-center w-full h-full ${tab === 'feed' ? 'text-[#7C3AED]' : 'text-[#A1A1AA] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
        </button>
        <button onClick={() => setTab('search')} className={`flex flex-col items-center justify-center w-full h-full ${tab === 'search' ? 'text-[#7C3AED]' : 'text-[#A1A1AA] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
        </button>
        <button onClick={() => setTab('my-posts')} className={`flex flex-col items-center justify-center w-full h-full ${tab === 'my-posts' ? 'text-[#7C3AED]' : 'text-[#A1A1AA] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
        </button>
        <button onClick={() => setTab('inbox')} className={`flex flex-col items-center justify-center w-full h-full ${tab === 'inbox' ? 'text-[#7C3AED]' : 'text-[#A1A1AA] hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
        </button>
      </nav>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative w-64 h-full bg-[#121214] border-r border-[#27272A] shadow-2xl p-6 animate-[slideRight_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
               <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-br from-[#7C3AED] to-[#DB2777]">Menu</span>
               <button onClick={() => setIsMenuOpen(false)} className="text-[#A1A1AA]">✕</button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs text-[#A1A1AA] mb-2 font-semibold">Your Secret Recovery Key</p>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-[#7C3AED] break-all bg-[#050505] p-2 rounded border border-[#27272A] block flex-1">{deviceKey}</code>
                  <button onClick={() => { if (deviceKey) { navigator.clipboard.writeText(deviceKey); alert("Key copied to clipboard!"); } }} className="p-2 bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30 rounded-lg hover:bg-[#7C3AED]/20 transition-all" title="Copy Key">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                  </button>
                </div>
              </div>
              <button onClick={restoreKey} className="w-full py-3 bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30 rounded-xl font-semibold hover:bg-[#7C3AED]/20 transition-all">Restore from Key</button>
            </div>
          </div>
        </div>
      )}

      {isComposerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsComposerOpen(false)}>
          <div className="w-full max-w-[600px] bg-[#121214] border-t border-[#27272A] rounded-t-3xl p-6 shadow-2xl animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-[#A1A1AA]">New Echo</span>
              <button onClick={() => setIsComposerOpen(false)} className="text-[#A1A1AA] hover:text-white">✕</button>
            </div>
            <input type="text" placeholder="Anonymous (Optional Name)" maxLength={28} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-transparent border-b border-[#27272A] pb-3 mb-4 text-sm text-[#A1A1AA] outline-none" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What is on your mind?" className="w-full bg-transparent outline-none resize-none text-lg text-white placeholder-[#52525B]" rows={4} autoFocus />
            <div className="flex justify-between items-center mt-6">
              <span className="text-xs text-[#52525B]">{content.length}/600</span>
              <button onClick={submitPost} disabled={!content.trim() || !canPost} className="bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white font-bold py-2.5 px-8 rounded-full disabled:opacity-50 hover:opacity-90 transition-opacity">{canPost ? 'Post' : 'Wait 60s'}</button>
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