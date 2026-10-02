/**
 * BookBridge Chat System
 * Injects a full chat panel (conversations + thread) into any page.
 * Requires: bb_token, bb_username in localStorage.
 */
(function () {
  const API = 'http://127.0.0.1:8000';
  const token = localStorage.getItem('bb_token');
  const myUser = localStorage.getItem('bb_username');
  if (!token || !myUser) return;

  // ── Inject Chat Panel HTML ──
  const panel = document.createElement('div');
  panel.id = 'bb-chat-panel';
  panel.innerHTML = `
    <div id="bb-chat-backdrop" class="fixed inset-0 bg-black/40 z-[200] hidden backdrop-blur-sm transition-opacity"></div>
    <div id="bb-chat-drawer" class="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-white z-[201] transform translate-x-full transition-transform duration-300 flex flex-col shadow-2xl border-l border-gray-200">
      <!-- Header -->
      <div class="h-16 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[#FF5C00] text-xl">forum</span>
          <span class="font-bold text-gray-900 text-sm uppercase tracking-wider">Tin nhắn</span>
        </div>
        <button id="bb-chat-close" class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <span class="material-symbols-outlined text-gray-500 text-xl">close</span>
        </button>
      </div>
      <!-- Search -->
      <div class="px-4 py-2 border-b border-gray-100 flex-shrink-0">
        <div class="relative">
          <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
          <input id="bb-chat-search" type="text" placeholder="Tìm kiếm người dùng..." class="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/30 transition-colors" autocomplete="off">
        </div>
        <div id="bb-search-results" class="hidden mt-2 max-h-40 overflow-y-auto"></div>
      </div>
      <!-- Conversation List View -->
      <div id="bb-convo-list-view" class="flex-1 overflow-y-auto">
        <div id="bb-convo-list" class="divide-y divide-gray-50">
          <div class="text-center text-gray-400 text-sm py-10">Đang tải...</div>
        </div>
      </div>
      <!-- Thread View (hidden by default) -->
      <div id="bb-thread-view" class="hidden flex-col flex-1">
        <div id="bb-thread-header" class="h-14 flex items-center gap-3 px-4 border-b border-gray-100 flex-shrink-0">
          <button id="bb-thread-back" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <span class="material-symbols-outlined text-gray-500 text-lg">arrow_back</span>
          </button>
          <div>
            <div id="bb-thread-name" class="font-bold text-gray-900 text-sm"></div>
            <div id="bb-thread-role" class="text-[10px] text-gray-400 uppercase tracking-wider"></div>
          </div>
        </div>
        <div id="bb-thread-messages" class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 bg-gray-50/50"></div>
        <div class="px-4 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
          <div class="flex gap-2">
            <input id="bb-thread-input" type="text" placeholder="Nhập tin nhắn..." class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/30 transition-colors" autocomplete="off">
            <button id="bb-thread-send" class="w-9 h-9 bg-[#FF5C00] text-white rounded-lg flex items-center justify-center hover:bg-[#e04f00] transition-colors flex-shrink-0">
              <span class="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ── References ──
  const backdrop = document.getElementById('bb-chat-backdrop');
  const drawer = document.getElementById('bb-chat-drawer');
  const closeBtn = document.getElementById('bb-chat-close');
  const searchInput = document.getElementById('bb-chat-search');
  const searchResults = document.getElementById('bb-search-results');
  const convoListView = document.getElementById('bb-convo-list-view');
  const convoList = document.getElementById('bb-convo-list');
  const threadView = document.getElementById('bb-thread-view');
  const threadBack = document.getElementById('bb-thread-back');
  const threadName = document.getElementById('bb-thread-name');
  const threadRole = document.getElementById('bb-thread-role');
  const threadMessages = document.getElementById('bb-thread-messages');
  const threadInput = document.getElementById('bb-thread-input');
  const threadSend = document.getElementById('bb-thread-send');

  let currentChatUser = null;

  // ── Open / Close ──
  function openChat() {
    backdrop.classList.remove('hidden');
    drawer.classList.remove('translate-x-full');
    loadConversations();
  }
  function closeChat() {
    backdrop.classList.add('hidden');
    drawer.classList.add('translate-x-full');
    showConvoList();
  }
  closeBtn.addEventListener('click', closeChat);
  backdrop.addEventListener('click', closeChat);

  // ── Expose global open function ──
  window.BBChat = {
    open: openChat,
    openWith: function(username) {
      openChat();
      openThread(username);
    }
  };

  // ── API helpers ──
  function authHeaders() {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  // ── Load Conversations ──
  async function loadConversations() {
    try {
      const res = await fetch(`${API}/messages/conversations`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.length) {
        convoList.innerHTML = '<div class="text-center text-gray-400 text-sm py-10 flex flex-col items-center gap-2"><span class="material-symbols-outlined text-3xl">chat_bubble_outline</span>Chưa có cuộc trò chuyện nào.<br><span class="text-xs">Tìm kiếm người dùng để bắt đầu.</span></div>';
        return;
      }
      convoList.innerHTML = data.map(c => {
        const roleLabel = c.role === 'teacher' ? 'Giáo viên' : 'Học sinh';
        const roleColor = c.role === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
        const unreadDot = c.unread > 0 ? `<span class="w-5 h-5 bg-[#FF5C00] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">${c.unread}</span>` : '';
        return `
          <div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors" onclick="BBChat.openWith('${c.username}')">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0 border border-gray-200">${c.username.charAt(0).toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-900 text-sm truncate">${c.username}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${roleColor} flex-shrink-0">${roleLabel}</span>
              </div>
              <div class="text-xs text-gray-400 truncate mt-0.5">${c.last_message}</div>
            </div>
            ${unreadDot}
          </div>`;
      }).join('');
    } catch (e) { console.error('Chat load error:', e); }
  }

  // ── Load & render unread badge ──
  async function loadUnreadBadge() {
    try {
      const res = await fetch(`${API}/messages/unread/count`, { headers: authHeaders() });
      const data = await res.json();
      const badge = document.getElementById('bb-chat-badge');
      if (badge) {
        if (data.count > 0) {
          badge.textContent = data.count > 9 ? '9+' : data.count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    } catch (e) {}
  }

  // ── Show convo list / hide thread ──
  function showConvoList() {
    threadView.classList.add('hidden');
    threadView.classList.remove('flex');
    convoListView.classList.remove('hidden');
    currentChatUser = null;
  }
  threadBack.addEventListener('click', () => {
    showConvoList();
    loadConversations();
  });

  // ── Open Thread ──
  async function openThread(otherUser) {
    currentChatUser = otherUser;
    threadName.textContent = otherUser;
    convoListView.classList.add('hidden');
    threadView.classList.remove('hidden');
    threadView.classList.add('flex');
    threadMessages.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Đang tải...</div>';
    try {
      const res = await fetch(`${API}/messages/${otherUser}`, { headers: authHeaders() });
      const msgs = await res.json();
      // Get role
      const searchRes = await fetch(`${API}/users/search?q=${otherUser}`, { headers: authHeaders() });
      const users = await searchRes.json();
      const u = users.find(x => x.username === otherUser);
      threadRole.textContent = u ? (u.role === 'teacher' ? 'Giáo viên' : 'Học sinh') : '';

      if (!msgs.length) {
        threadMessages.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Hãy gửi tin nhắn đầu tiên!</div>';
      } else {
        threadMessages.innerHTML = msgs.map(m => {
          const isMine = m.from === myUser;
          const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : '';
          return `<div class="flex ${isMine ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[75%] px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-[#FF5C00] text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}">
              <div>${m.text}</div>
              <div class="text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-gray-400'} text-right">${time}</div>
            </div>
          </div>`;
        }).join('');
      }
      threadMessages.scrollTop = threadMessages.scrollHeight;
      threadInput.focus();
      loadUnreadBadge();
    } catch (e) { console.error('Thread load error:', e); }
  }

  // ── Send Message ──
  async function sendMsg() {
    const text = threadInput.value.trim();
    if (!text || !currentChatUser) return;
    threadInput.value = '';
    // Optimistic append
    const now = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
    threadMessages.innerHTML += `<div class="flex justify-end"><div class="max-w-[75%] px-3 py-2 rounded-2xl text-sm bg-[#FF5C00] text-white rounded-br-sm"><div>${text}</div><div class="text-[10px] mt-1 text-white/60 text-right">${now}</div></div></div>`;
    threadMessages.scrollTop = threadMessages.scrollHeight;
    try {
      await fetch(`${API}/messages/send`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ to: currentChatUser, text })
      });
    } catch (e) { console.error('Send error:', e); }
  }
  threadSend.addEventListener('click', sendMsg);
  threadInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });

  // ── Search Users ──
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (!q) { searchResults.classList.add('hidden'); return; }
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/users/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
        const users = await res.json();
        if (!users.length) {
          searchResults.innerHTML = '<div class="text-xs text-gray-400 py-2 text-center">Không tìm thấy</div>';
        } else {
          searchResults.innerHTML = users.map(u => {
            const rl = u.role === 'teacher' ? 'GV' : 'HS';
            const rc = u.role === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
            return `<div class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors" onclick="BBChat.openWith('${u.username}'); document.getElementById('bb-chat-search').value=''; document.getElementById('bb-search-results').classList.add('hidden');">
              <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs border border-gray-200">${u.username.charAt(0).toUpperCase()}</div>
              <span class="font-bold text-sm text-gray-900">${u.username}</span>
              ${u.fullname ? `<span class="text-xs text-gray-400">${u.fullname}</span>` : ''}
              <span class="text-[9px] font-bold px-1 py-0.5 rounded ${rc} ml-auto">${rl}</span>
            </div>`;
          }).join('');
        }
        searchResults.classList.remove('hidden');
      } catch (e) {}
    }, 300);
  });

  // Poll unread count every 15s
  loadUnreadBadge();
  setInterval(loadUnreadBadge, 15000);
})();
