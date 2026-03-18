'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DiseaseKey } from '@/lib/disease-data';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'cosmo';
  text: string;
  timestamp: Date;
}

interface CosmoAction {
  disease?: string;
  country?: string;
}

interface Props {
  country: string;
  disease: DiseaseKey;
  cases: number;
  riskScore: number;
  region: string;
  onAction: (action: CosmoAction) => void;
}

// ── Starter action cards ───────────────────────────────────────────────────────
const STARTER_CARDS = [
  {
    icon: '🌍',
    title: 'Country-wise Comparative Statistics',
    query: (country: string, disease: string) =>
      `Compare ${disease} cases and risk scores for ${country} vs top affected countries`,
  },
  {
    icon: '🧬',
    title: 'Genomic / Strain Impact Analysis',
    query: (country: string, disease: string, region: string) =>
      `Analyze genomic variants and strain impact for ${disease} in ${region}`,
  },
  {
    icon: '🔥',
    title: 'Hotspot Detection',
    query: (_country: string, disease: string) =>
      `Show ${disease} hotspots globally`,
  },
] as const;

// ── Shared styles ──────────────────────────────────────────────────────────────
const S = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
    fontFamily: 'Inter, sans-serif',
  },
  header: {
    flexShrink: 0,
    padding: '14px 16px 10px',
    borderBottom: '1px solid rgba(0,100,160,0.1)',
  },
  headerTitle: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#d0eeff',
    letterSpacing: '0.04em',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerSub: {
    fontSize: '0.6rem',
    color: '#4a6a82',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    marginTop: 3,
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 14px',
    scrollbarWidth: 'thin' as const,
    scrollbarColor: 'rgba(0,140,200,0.15) transparent',
  },
  welcomeArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  welcomeText: {
    fontSize: '0.7rem',
    color: '#5a80a0',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  card: {
    background: 'rgba(0,30,60,0.7)',
    border: '1px solid rgba(0,100,160,0.2)',
    borderRadius: 10,
    padding: '12px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    textAlign: 'left' as const,
    alignItems: 'flex-start' as const,
  },
  cardIcon: {
    fontSize: '1.2rem',
    lineHeight: 1,
  },
  cardTitle: {
    fontSize: '0.63rem',
    color: '#90c0e0',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0.01em',
  },
  inputBar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid rgba(0,100,160,0.12)',
    background: 'rgba(0,10,30,0.6)',
  },
  input: {
    flex: 1,
    background: 'rgba(0,20,50,0.8)',
    border: '1px solid rgba(0,100,160,0.2)',
    borderRadius: 20,
    padding: '8px 14px',
    fontSize: '0.72rem',
    color: '#c0dff0',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.4,
  },
  sendBtn: {
    background: 'rgba(0,120,200,0.7)',
    border: 'none',
    borderRadius: 20,
    padding: '8px 14px',
    color: '#d8f0ff',
    fontSize: '0.68rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  },
  // Chat bubbles
  bubbleRow: (role: 'user' | 'cosmo') => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
    marginBottom: 10,
    gap: 8,
    alignItems: 'flex-end',
  }),
  bubble: (role: 'user' | 'cosmo') => ({
    maxWidth: '82%',
    padding: '9px 13px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    fontSize: '0.7rem',
    lineHeight: 1.55,
    background: role === 'user'
      ? 'rgba(0,90,160,0.55)'
      : 'rgba(0,25,55,0.85)',
    border: role === 'user'
      ? '1px solid rgba(0,140,220,0.25)'
      : '1px solid rgba(0,100,160,0.18)',
    color: role === 'user' ? '#d0eeff' : '#a8ccdf',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  }),
  avatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'rgba(0,80,140,0.6)',
    border: '1px solid rgba(0,120,180,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    flexShrink: 0,
  },
  thinkingDot: {
    display: 'inline-block',
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#70c8ec',
    marginRight: 3,
    animation: 'cosmo-pulse 1.2s ease-in-out infinite',
  },
};

// ── Simple markdown renderer (handles **bold** only) ──────────────────────────
function renderText(text: string) {
  return text.split('\n').map((line, li) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={li}>
        {parts.map((part, pi) =>
          pi % 2 === 1
            ? <strong key={pi} style={{ color: '#c8e8ff', fontWeight: 600 }}>{part}</strong>
            : <span key={pi}>{part}</span>
        )}
        {li < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CosmoTab({ country, disease, cases, riskScore, region, onAction }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [started, setStarted]   = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStarted(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cosmo/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: { country, disease, cases, riskScore, region },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const cosmoMsg: Message = {
        role: 'cosmo',
        text: data.reply || "I'm unable to find sufficient data for this request at the moment",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, cosmoMsg]);

      // Trigger globe navigation if action returned
      if (data.action && (data.action.disease || data.action.country)) {
        onAction(data.action);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'cosmo',
        text: "I'm unable to find sufficient data for this request at the moment",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, country, disease, cases, riskScore, region, onAction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCardClick = (cardIndex: number) => {
    const card = STARTER_CARDS[cardIndex];
    const query = cardIndex === 1
      ? card.query(country, disease, region)
      : (card.query as (c: string, d: string) => string)(country, disease);
    sendMessage(query);
  };

  return (
    <div style={S.wrapper}>
      {/* ── Pulse animation keyframes injected once ─── */}
      <style>{`
        @keyframes cosmo-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes cosmo-pulse-delay-1 {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        .cosmo-input::placeholder { color: rgba(100,160,200,0.5); }
        .cosmo-card:hover {
          background: rgba(0,50,90,0.75) !important;
          border-color: rgba(0,140,200,0.4) !important;
          transform: translateY(-1px);
        }
        .cosmo-send:hover { background: rgba(0,140,220,0.85) !important; }
      `}</style>

      {/* ── Header ─── */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <span>Cosmo</span>
          <span style={{ fontSize: '0.6rem', fontWeight: 400, color: '#4a8aaa', marginLeft: 2 }}>
            AI Disease Intelligence
          </span>
        </div>
        <div style={S.headerSub}>
          Viewing · {country} · {disease.toUpperCase()}
        </div>
      </div>

      {/* ── Main area: welcome cards OR chat thread ─── */}
      {!started ? (
        <div style={S.welcomeArea}>
          <p style={S.welcomeText}>
            Hi, I&apos;m <strong style={{ color: '#70c8ec' }}>Cosmo</strong> — your AI guide to{' '}
            <strong style={{ color: '#70c8ec' }}>CosmoSentinel</strong>. Ask me anything about
            disease surveillance, genomics, hotspots, forecasts, or how to navigate this dashboard.
          </p>

          <div style={{ fontSize: '0.62rem', color: '#3a6080', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>
            Suggested actions
          </div>

          <div style={S.cardsGrid}>
            {STARTER_CARDS.map((card, i) => (
              <button
                key={card.title}
                className="cosmo-card"
                onClick={() => handleCardClick(i)}
                style={{
                  ...S.card,
                  // 3rd card spans full width
                  gridColumn: i === 2 ? '1 / -1' : undefined,
                }}
              >
                <span style={S.cardIcon}>{card.icon}</span>
                <span style={S.cardTitle}>{card.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.chatArea}>
          {messages.map((msg, idx) => (
            <div key={idx} style={S.bubbleRow(msg.role)}>
              {msg.role === 'cosmo' && (
                <div style={S.avatar}>🛰️</div>
              )}
              <div style={{ ...S.bubble(msg.role), whiteSpace: 'pre-wrap' }}>
                {msg.role === 'cosmo' ? renderText(msg.text) : msg.text}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {loading && (
            <div style={S.bubbleRow('cosmo')}>
              <div style={S.avatar}>🛰️</div>
              <div style={{ ...S.bubble('cosmo'), display: 'flex', alignItems: 'center', gap: 2, minWidth: 56 }}>
                <span style={{ ...S.thinkingDot, animationDelay: '0s' }} />
                <span style={{ ...S.thinkingDot, animationDelay: '0.2s' }} />
                <span style={{ ...S.thinkingDot, animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Input bar (always visible) ─── */}
      <div style={S.inputBar}>
        <input
          ref={inputRef}
          className="cosmo-input"
          style={S.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Cosmo anything…"
          disabled={loading}
        />
        <button
          className="cosmo-send"
          style={{
            ...S.sendBtn,
            opacity: loading || !input.trim() ? 0.4 : 1,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
        >
          Send ➤
        </button>
      </div>
    </div>
  );
}
