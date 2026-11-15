import { useEffect, useRef, useState } from 'react';

const SUGGESTIONS = [
  { icon: '◷', title: 'Find your balance', detail: 'Plan a calmer, more focused week', prompt: 'Help me plan a week that feels more balanced' },
  { icon: '✧', title: 'Learn something curious', detail: 'Explore an idea you’ve never met', prompt: 'Explain a fascinating idea in science in a simple way' },
  { icon: '⌁', title: 'Make something new', detail: 'Turn a spark into a real project', prompt: 'Help me brainstorm a creative project I could start this month' },
];

function readChats() {
  try { return JSON.parse(localStorage.getItem('orbit-chats') || '[]'); }
  catch { return []; }
}

function Message({ message, last, onCopy, onSpeak }) {
  return (
    <div className={`message ${message.role}`}>
      {message.role === 'assistant' && <div className="badge">✳</div>}
      <div className="message-body">
        {message.image && <img className="message-image" src={message.image} alt="Image attached for analysis" />}
        <div className="bubble">{message.content}</div>
        {message.role === 'assistant' && last && (
          <div className="message-actions">
            <button onClick={() => onCopy(message.content)}>Copy</button>
            <button onClick={() => onSpeak(message.content)}>Read aloud</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-4 0h8" /></svg>;
}

function SendIcon() {
  return <svg viewBox="0 0 24 24"><path d="M12 19V5m-7 7 7-7 7 7" /></svg>;
}

export default function App() {
  const initialChats = useRef(readChats());
  const [chats, setChats] = useState(initialChats.current);
  const [currentId, setCurrentId] = useState(() => Number(localStorage.getItem('orbit-current')) || Date.now());
  const [messages, setMessages] = useState(() => initialChats.current.find((chat) => chat.id === (Number(localStorage.getItem('orbit-current')) || 0))?.messages || []);
  const [prompt, setPrompt] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('chat');
  const [toast, setToast] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('orbit-dark') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [listening, setListening] = useState(false);
  const [connection, setConnection] = useState('Checking models…');
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const conversationRef = useRef(null);
  const recognitionRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem('orbit-dark', String(dark));
  }, [dark]);

  useEffect(() => {
    if (!toast) return undefined;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3300);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  useEffect(() => {
    if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    fetch('/api/config').then((response) => response.json()).then((config) => {
      setConnection(config.groq && config.voice ? 'AI connected' : 'Add API keys to connect');
    }).catch(() => setConnection('Models unavailable'));
  }, []);

  const notify = (text) => setToast(text);

  function storeChat(nextMessages) {
    let nextChats = chats.slice();
    const existing = nextChats.find((chat) => chat.id === currentId);
    const title = nextMessages.find((message) => message.role === 'user')?.content.slice(0, 38) || 'New chat';
    const nextChat = { id: currentId, title: existing?.title || title, messages: nextMessages };
    nextChats = existing ? nextChats.map((chat) => chat.id === currentId ? nextChat : chat) : [...nextChats, nextChat];
    setChats(nextChats);
    try {
      localStorage.setItem('orbit-chats', JSON.stringify(nextChats));
      localStorage.setItem('orbit-current', String(currentId));
    } catch {
      const lightChats = nextChats.map((chat) => ({ ...chat, messages: chat.messages.map(({ role, content }) => ({ role, content })) }));
      try { localStorage.setItem('orbit-chats', JSON.stringify(lightChats)); notify('Chat saved without image previews to fit browser storage.'); }
      catch { notify('This chat is too large to save in browser storage.'); }
    }
  }

  function startNewChat() {
    if (messages.length) storeChat(messages);
    setMessages([]);
    setAttachment(null);
    setPrompt('');
    const id = Date.now();
    setCurrentId(id);
    localStorage.setItem('orbit-current', String(id));
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  function openChat(chat) {
    setCurrentId(chat.id);
    setMessages(chat.messages || []);
    localStorage.setItem('orbit-current', String(chat.id));
    setSidebarOpen(false);
  }

  function speak(text) {
    if (!window.speechSynthesis) return notify('Speech playback is not supported in this browser.');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  async function pickImage(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return notify('Choose a PNG, JPG, or WebP image.');
    if (file.size > 12 * 1024 * 1024) return notify('Image must be smaller than 12 MB.');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let data = canvas.toDataURL('image/jpeg', 0.82);
      if (data.length > 3_400_000) data = canvas.toDataURL('image/jpeg', 0.6);
      if (data.length > 3_700_000) throw new Error('Image is too large for serverless upload. Choose a smaller image.');
      setAttachment({ data, name: file.name });
    } catch (error) { notify(error.message || 'Could not read that image.'); }
  }

  async function sendMessage(text = prompt.trim(), fromVoice = false) {
    const image = attachment;
    if ((!text && !image) || busy) return;
    const userText = image && !text ? 'Please analyze this image and tell me what you notice.' : text;
    const userMessage = { role: 'user', content: userText, ...(image ? { image: image.data, imageName: image.name } : {}) };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setPrompt('');
    setAttachment(null);
    setBusy(true);
    try {
      const context = nextMessages.slice(-12);
      let lastImage = -1;
      context.forEach((message, index) => { if (message.image) lastImage = index; });
      const body = [
        { role: 'system', content: `You are Mine AI 1.0, created by Joshua Fred. Be thoughtful, clear, and helpful. For voice replies, speak naturally and concisely. You use connected AI APIs at request time to generate answers; this app does not train models on API responses or user conversations. Never claim otherwise.` },
        ...context.map((message, index) => ({ role: message.role, content: message.content, ...(index === lastImage ? { image: message.image } : {}) })),
      ];
      const endpoint = fromVoice ? '/api/voice' : lastImage >= 0 ? '/api/vision' : '/api/chat';
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      if (!data.answer) throw new Error('Empty model response');
      const completed = [...nextMessages, { role: 'assistant', content: data.answer }];
      setMessages(completed);
      storeChat(completed);
      if (fromVoice) speak(data.answer);
    } catch (error) {
      setMessages(messages);
      if (image) setAttachment(image);
      notify(error.message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function beginVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return notify('Voice input needs Chrome or Edge; you can type instead.');
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      recognitionRef.current = null;
      sendMessage(transcript, true);
    };
    recognition.onerror = (event) => notify(event.error === 'not-allowed' ? 'Allow microphone access to use voice.' : 'Could not hear that. Try again.');
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    setListening(true);
    notify('Listening… go ahead.');
    recognition.start();
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); notify('Copied'); }
    catch { notify('Could not access the clipboard.'); }
  }

  async function shareApp() {
    try { await navigator.clipboard.writeText(location.href); notify('App address copied.'); }
    catch { notify('Could not access the clipboard.'); }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="side-top">
          <a className="brand" href="#"><span className="brand-mark">✳</span><span>mine ai</span></a>
          <button className="icon-btn collapse" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label="Collapse sidebar">◧</button>
        </div>
        <button className="new-chat" onClick={startNewChat}><b>＋</b><span>New chat</span></button>
        <div className="side-label">YOUR SPACE</div>
        <button className="nav-item active" onClick={startNewChat}><span className="nav-icon">⌂</span><span>Explore</span></button>
        <button className="nav-item" onClick={() => chats.length ? document.getElementById('historyList')?.scrollIntoView({ behavior: 'smooth' }) : notify('Your conversations will show up here.')}><span className="nav-icon">◷</span><span>Recent chats</span></button>
        <div className="history-wrap"><div className="side-label">RECENT</div><div id="historyList">{chats.slice().reverse().slice(0, 20).map((chat) => <button className="history-entry" key={chat.id} onClick={() => openChat(chat)} title={chat.title}>{chat.title}</button>)}</div></div>
        <div className="side-bottom"><div className="connection"><i className={connection === 'Models connected' ? 'ready' : ''} />{connection}</div><div className="user-card"><div className="avatar">J</div><div><b>Your workspace</b><small>Personal</small></div></div></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open menu">☰</button>
          <div className="model-switch"><b className="model-star">✳</b><b>Mine AI 1.0</b><span>AI assistant</span></div>
          <div><button className="icon-btn" onClick={() => setDark(!dark)} title="Toggle theme" aria-label="Toggle theme">◐</button><button className="share-btn" onClick={shareApp}>↗ Share</button></div>
        </header>
        <section className="conversation" id="conversation" ref={conversationRef}>
          {!messages.length && <div className="welcome"><div className="welcome-orb">✳</div><div className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</div><h1>What should we<br /><span>talk about?</span></h1><p>Ask anything, think out loud, or use your voice. I'm here to help you make sense of it.</p><div className="suggestions">{SUGGESTIONS.map((item, index) => <button key={item.title} onClick={() => sendMessage(item.prompt)}><i className={`suggestion-icon suggestion-${index}`}>{item.icon}</i><span><b>{item.title}</b><small>{item.detail}</small></span></button>)}</div></div>}
          <div className="messages">{messages.map((message, index) => <Message key={`${index}-${message.role}`} message={message} last={index === messages.length - 1} onCopy={copyText} onSpeak={speak} />)}</div>
          {busy && <div className="typing">✳ &nbsp; Thinking…</div>}
        </section>
        <div className="composer-area"><div className="composer">
          {attachment && <div className="attachment-preview"><img src={attachment.data} alt="Selected image" /><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} title="Remove image">×</button></div>}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => pickImage(event.target.files[0])} />
          <textarea ref={inputRef} rows="1" placeholder="Ask anything" value={prompt} onChange={(event) => { setPrompt(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
          <div className="composer-tools"><div><button className="tool-btn" onClick={() => fileRef.current?.click()} title="Add an image" aria-label="Add an image">＋</button><button className="mode-btn" onClick={() => setMode(mode === 'chat' ? 'voice' : 'chat')}><i /><span>{mode === 'chat' ? 'Chat' : 'Mine AI Voice'}</span>⌄</button></div><div className="composer-right"><span>Mine AI Voice</span><button className={`voice-btn ${listening ? 'listening' : ''}`} onClick={beginVoice} title="Talk to Mine AI" aria-label="Talk to Mine AI"><MicIcon /></button><button className="send-btn" onClick={() => sendMessage()} aria-label="Send" disabled={busy}><SendIcon /></button></div></div>
        </div><div className="disclaimer">Mine AI 1.0 · Created by Joshua Fred · Can make mistakes; check important information.</div></div>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
