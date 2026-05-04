'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  role?: string;
}

const SUGGESTED_PROMPTS = [
  'Which client has the highest CPL this month?',
  'Which clients are underperforming?',
  'How are GBP calls trending overall?',
  'Which client should I focus on?',
];

export default function ChatWidget({ role }: ChatWidgetProps) {
  // Only render for admin/team
  if (role !== 'admin' && role !== 'team') return null;
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading || limitHit) return;

    setError(null);
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          messages: messages.slice(-6), // send last 6 for context
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setLimitHit(true);
          setError(data.error || 'Daily limit reached.');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        // Remove the user message if failed
        setMessages(messages);
        return;
      }

      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open AI assistant"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          width: '52px', height: '52px', borderRadius: '50%',
          background: open ? '#5c5850' : 'linear-gradient(135deg, #c4704f, #d9a854)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(196,112,79,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 200ms ease',
          fontSize: '22px',
        }}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '88px', right: '24px', zIndex: 9998,
          width: 'min(360px, calc(100vw - 32px))',
          height: 'min(520px, calc(100vh - 120px))',
          background: '#fff',
          borderRadius: '20px',
          boxShadow: '0 12px 48px rgba(44,36,25,0.18)',
          border: '1px solid rgba(44,36,25,0.1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideIn 0.2s ease',
        }}>
          <style>{`
            @keyframes chatSlideIn {
              from { opacity: 0; transform: translateY(12px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .chat-msg-user { align-self: flex-end; background: linear-gradient(135deg,#c4704f,#d9a854); color:#fff; border-radius:16px 16px 4px 16px; }
            .chat-msg-ai   { align-self: flex-start; background: rgba(44,36,25,0.05); color:#2c2419; border-radius:16px 16px 16px 4px; }
            .chat-input:focus { outline: none; }
            .chat-send:hover { background: #c4704f !important; }
            .chat-suggest:hover { background: rgba(196,112,79,0.12) !important; }
            .chat-md p { margin: 0 0 8px; }
            .chat-md p:last-child { margin-bottom: 0; }
            .chat-md strong { color: #2c2419; font-weight: 700; }
            .chat-md em { color: #c4704f; font-style: italic; }
            .chat-md ul, .chat-md ol { margin: 4px 0 8px; padding-left: 18px; }
            .chat-md li { margin-bottom: 3px; }
            .chat-md li::marker { color: #c4704f; }
            .chat-md h1,.chat-md h2,.chat-md h3 { font-size: 13px; font-weight: 700; margin: 8px 0 4px; color: #2c2419; }
            .chat-md h3 { color: #c4704f; }
            .chat-md code { background: rgba(196,112,79,0.1); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
            .chat-md .table-wrap { overflow-x: auto; margin: 6px -6px; padding: 0 6px; }
            .chat-md table { border-collapse: collapse; font-size: 11px; white-space: nowrap; min-width: 100%; }
            .chat-md th { background: rgba(196,112,79,0.12); padding: 4px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid rgba(196,112,79,0.3); }
            .chat-md td { padding: 3px 6px; border-bottom: 1px solid rgba(44,36,25,0.08); }
            .chat-md tr:hover td { background: rgba(196,112,79,0.05); }
            .chat-md blockquote { margin: 6px 0; padding: 4px 10px; border-left: 3px solid #c4704f; background: rgba(196,112,79,0.05); }
            .chat-md hr { border: none; border-top: 1px solid rgba(44,36,25,0.1); margin: 8px 0; }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '16px 18px',
            background: 'linear-gradient(135deg, #c4704f, #d9a854)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>🤖</div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' }}>WiseCRM Assistant</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Ask about client data</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Welcome */}
            {isEmpty && (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <p style={{ fontSize: '13px', color: '#5c5850', marginBottom: '14px', lineHeight: 1.5 }}>
                  Hi! I have the last 30 days of data for all active clients. What would you like to know?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <button key={i} className="chat-suggest" onClick={() => send(p)} style={{
                      padding: '8px 12px', borderRadius: '10px', fontSize: '12px',
                      background: 'rgba(196,112,79,0.08)', border: '1px solid rgba(196,112,79,0.2)',
                      color: '#c4704f', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 150ms ease',
                    }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai chat-md'} style={{
                padding: '10px 14px', fontSize: '13px', lineHeight: 1.5,
                maxWidth: '85%', wordBreak: 'break-word',
              }}>
                {m.role === 'user' ? m.content : (
                  <ReactMarkdown components={{ table: ({ children }) => <div className="table-wrap"><table>{children}</table></div> }}>
                    {m.content}
                  </ReactMarkdown>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div className="chat-msg-ai" style={{ padding: '12px 16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: '#c4704f', display: 'block',
                    animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
                  }} />
                ))}
                <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }`}</style>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px', fontSize: '12px',
                background: 'rgba(196,112,79,0.08)', border: '1px solid rgba(196,112,79,0.2)',
                color: '#8a4a2e',
              }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(44,36,25,0.08)',
            display: 'flex', gap: '8px', alignItems: 'center',
            background: '#fafaf9',
          }}>
            {limitHit ? (
              <p style={{ flex: 1, fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
                Daily limit reached. Come back tomorrow!
              </p>
            ) : (
              <>
                <input
                  ref={inputRef}
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about client performance..."
                  maxLength={500}
                  disabled={loading}
                  style={{
                    flex: 1, border: '1px solid rgba(44,36,25,0.12)',
                    borderRadius: '12px', padding: '9px 14px',
                    fontSize: '13px', color: '#2c2419',
                    background: '#fff',
                    resize: 'none',
                  }}
                />
                <button
                  className="chat-send"
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  style={{
                    width: '38px', height: '38px', borderRadius: '12px',
                    background: input.trim() ? '#c4704f' : 'rgba(44,36,25,0.08)',
                    border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', transition: 'background 150ms ease', flexShrink: 0,
                  }}
                >
                  {loading ? '⏳' : '➤'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
