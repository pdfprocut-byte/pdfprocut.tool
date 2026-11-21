import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaLayerGroup, FaPaperPlane, FaRobot, FaSearch, FaShieldAlt, FaStar, FaTimes } from 'react-icons/fa';
import { apiRequest } from '../lib/authApi.js';
import '../styles/assistantChat.css';

const initialMessage = {
  role: 'assistant',
  content: 'Tell me what you want to do with your file. I’ll help you find the right tool.'
};
const assistantNotice = 'I am reviewing the tools available in this app and their usage guidelines. I do not have permission to access your private files or send messages to external AI services.';
const suggestions = [
  { label: 'See all tools', question: 'List all tools', icon: FaStar, tone: 'violet' },
  { label: 'Merge my PDFs', question: 'How do I merge PDFs?', icon: FaLayerGroup, tone: 'blue' },
  { label: 'Read a scanned PDF', question: 'Can I search a scanned PDF?', icon: FaSearch, tone: 'pink' }
];
const appPaths = /(\/tools(?:\/[a-z0-9-]+)?|\/guides|\/about|\/contact|\/profile|\/login|\/register|\/privacy-policy|\/terms|\/word-editor)/gi;

function MessageText({ text }) {
  return text.split(appPaths).map((part, index) => /^\/(tools(?:\/[a-z0-9-]+)?|guides|about|contact|profile|login|register|privacy-policy|terms|word-editor)$/i.test(part)
    ? <Link key={`${part}-${index}`} to={part}>{part}</Link>
    : part);
}

function AssistantAvatar() {
  return <span className="assistant-bot" aria-hidden="true">
    <span className="assistant-bot-antenna"/>
    <span className="assistant-bot-ear assistant-bot-ear-left"/>
    <span className="assistant-bot-ear assistant-bot-ear-right"/>
    <span className="assistant-bot-head">
      <span className="assistant-bot-face"><i/><i/></span>
      <span className="assistant-bot-smile"/>
    </span>
  </span>;
}

export default function AssistantChat() {
  const { pathname } = useLocation();
  const isToolPage = /^\/tools\/[^/]+/.test(pathname);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([initialMessage]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const launcherRef = useRef(null);
  const previousOpenRef = useRef(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (previousOpenRef.current) launcherRef.current?.focus();
    previousOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = messages.length === 1 ? 0 : listRef.current.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 104)}px`;
  }, [draft, open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const sendMessage = async (value = draft) => {
    const question = value.trim();
    if (!question || sending || question.length > 1200) return;
    const history = messages.slice(1).filter((message) => !message.failed).slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((previous) => [...previous, { role: 'user', content: question }]);
    setDraft('');
    setSending(true);
    try {
      const result = await apiRequest('assistant/chat', {
        method: 'POST',
        body: { question, history, currentPath: pathname }
      });
      setMessages((previous) => [...previous, { role: 'assistant', content: result.answer }]);
    } catch (error) {
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: error.message || 'I could not connect just now. Please try again shortly.',
        failed: true
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return <div className={`assistant-chat-root${open ? ' is-open' : ''}${isToolPage ? ' is-tool-page' : ''}`}>
    {open && <section id="assistant-chat-panel" className="assistant-chat-panel" role="dialog" aria-labelledby="assistant-chat-title" aria-modal="false">
      <header className="assistant-chat-header">
        <span className="assistant-chat-avatar"><AssistantAvatar/></span>
        <div className="assistant-chat-heading"><span>TOOLS &amp; GUIDES</span><h2 id="assistant-chat-title">Alien</h2></div>
        <button className="assistant-chat-close" type="button" aria-label="Close Alien chat" onClick={() => setOpen(false)}><FaTimes aria-hidden="true"/></button>
      </header>

      <div className="assistant-chat-notice"><FaShieldAlt aria-hidden="true"/><p>{assistantNotice}</p></div>

      <div className="assistant-chat-messages" ref={listRef} aria-live="polite" aria-relevant="additions text">
        {messages.length === 1 && <div className="assistant-chat-welcome">
          <div className="assistant-chat-welcome-art" aria-hidden="true"><AssistantAvatar/><FaStar className="assistant-chat-spark assistant-chat-spark-cyan"/><FaStar className="assistant-chat-spark assistant-chat-spark-pink"/></div>
          <span className="assistant-chat-welcome-kicker">YOUR FILES. MADE SIMPLE.</span>
          <h3>Hi, I’m Alien.</h3>
          <p>{initialMessage.content}</p>
        </div>}
        {messages.length > 1 && messages.map((message, index) => <div key={`${message.role}-${index}`} className={`assistant-chat-message assistant-chat-message-${message.role}${message.failed ? ' is-error' : ''}`}>
          <span className="assistant-chat-message-label">{message.role === 'user' ? 'You' : <><FaRobot aria-hidden="true"/> Alien</>}</span>
          <div className={`assistant-chat-bubble${message.failed ? ' is-error' : ''}`}><MessageText text={message.content}/></div>
        </div>)}
        {sending && <div className="assistant-chat-message assistant-chat-message-assistant"><div className="assistant-chat-bubble assistant-chat-thinking" aria-label="Alien is responding"><i/><i/><i/></div></div>}
        {messages.length === 1 && <div className="assistant-chat-suggestions" aria-label="Suggested questions">
          {suggestions.map(({ label, question, icon: Icon, tone }) => <button type="button" key={question} onClick={() => sendMessage(question)} disabled={sending}>
            <span className={`assistant-chat-suggestion-icon is-${tone}`}><Icon aria-hidden="true"/></span><span>{label}</span>
          </button>)}
        </div>}
      </div>

      <form className="assistant-chat-form" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
        <label className="visually-hidden" htmlFor="assistant-chat-input">Ask Alien a question</label>
        <div className="assistant-chat-composer">
          <textarea
            ref={inputRef}
            id="assistant-chat-input"
            value={draft}
            maxLength={1200}
            rows={1}
            placeholder="Ask Alien about a tool..."
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button type="submit" aria-label="Send message" disabled={sending || !draft.trim()}><FaPaperPlane aria-hidden="true"/></button>
        </div>
        <div className="assistant-chat-form-meta"><span><kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for a new line</span><span>{draft.length}/1200</span></div>
      </form>
    </section>}
    <button
      ref={launcherRef}
      className={`assistant-chat-launcher${open ? ' is-open' : ''}`}
      type="button"
      aria-label={open ? 'Close Alien chat' : 'Open Alien chat'}
      aria-expanded={open}
      aria-controls="assistant-chat-panel"
      onClick={() => setOpen((value) => !value)}
    >{open ? <FaTimes aria-hidden="true"/> : <><span className="assistant-chat-launcher-art"><AssistantAvatar/></span><span className="assistant-chat-launcher-copy"><strong>Alien</strong><small>A little help, right here</small></span><span className="assistant-chat-launcher-spark" aria-hidden="true"><FaStar/></span></>}</button>
  </div>;
}
