import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  type?: 'success' | 'warning' | 'info';
}

interface Props {
  messages: ToastMessage[];
  onDismiss: (id: number) => void;
}

export default function Toast({ messages, onDismiss }: Props) {
  return (
    <div
      className="fixed top-4 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
      style={{ zIndex: 100 }}
    >
      {messages.map((msg) => (
        <ToastItem key={msg.id} msg={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(msg.id), 300);
    }, 3200);
    return () => clearTimeout(t);
  }, [msg.id, onDismiss]);

  const bg =
    msg.type === 'warning' ? '#fffbeb' :
    msg.type === 'success' ? '#f0fdf4' :
    '#ffffff';
  const border =
    msg.type === 'warning' ? '#fde68a' :
    msg.type === 'success' ? '#bbf7d0' :
    '#e5e7eb';
  const textColor =
    msg.type === 'warning' ? '#92400e' :
    msg.type === 'success' ? '#15803d' :
    '#0d0d0d';

  return (
    <div
      className="pointer-events-auto mx-4 px-4 py-3 rounded-2xl text-sm font-semibold max-w-xs text-center"
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: textColor,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      {msg.text}
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

let _nextId = 1;

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const show = (text: string, type: ToastMessage['type'] = 'info') => {
    const id = _nextId++;
    setMessages((prev) => [...prev, { id, text, type }]);
  };

  const dismiss = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return { messages, show, dismiss };
}
