'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { ModelSelector, ModelSelectorValue } from '@/components/ai/ModelSelector';
import { useUserAIDefaults } from '@/lib/hooks/useUserAIDefaults';
import type { PageContext } from '@/lib/ai/services/tutorContext';

interface Message { role: 'user' | 'assistant'; content: string }
const TutorFocus = createContext<((path: string, title: string) => void) | null>(null);

export function useTutorFocus(title?: string) {
  const report = useContext(TutorFocus);
  const path = usePathname();
  useEffect(() => { if (title) report?.(path, title); }, [report, path, title]);
}

const TutorVisibility = createContext<((path: string, hidden: boolean) => void) | null>(null);

export function useQuizTutorVisibility(hidden: boolean) {
  const report = useContext(TutorVisibility);
  const path = usePathname();
  useEffect(() => {
    report?.(path, hidden);
    return () => { report?.(path, true); };
  }, [report, path, hidden]);
}

export function pageContextForPath(path: string): PageContext {
  const lesson = path.match(/\/lessons\/([^/]+)/);
  if (lesson) return { type: 'lesson', entityId: lesson[1] };
  const assignment = path.match(/\/assignments\/([^/]+)/);
  if (assignment) return { type: 'assignment', entityId: assignment[1] };
  const moduleMatch = path.match(/\/modules\/([^/]+)/);
  if (moduleMatch) return { type: 'module', entityId: moduleMatch[1] };
  const label = path.split('/').at(-1) || 'Course';
  return label === 'overview' ? { type: 'overview' } : { type: 'page', label: label.replace(/-/g, ' ') };
}

export function CourseTutorProvider({ courseId, children }: { courseId: string; children: ReactNode }) {
  const path = usePathname();
  const page = useMemo(() => pageContextForPath(path), [path]);
  const [focus, setFocus] = useState<{ path: string; title: string } | null>(null);
  const reportFocus = useMemo(() => (path: string, title: string) => setFocus({ path, title }), []);
  const [quizVisibility, setQuizVisibility] = useState<{ path: string; hidden: boolean } | null>(null);
  const report = useMemo(() => (path: string, hidden: boolean) => setQuizVisibility({ path, hidden }), []);
  const fullPage = path.endsWith('/ai/tutor');
  const hidden = fullPage || path.endsWith('/quiz') && (quizVisibility?.path !== path || quizVisibility.hidden);
  const [storageKey, setStorageKey] = useState<string>();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState(false);
  const [reload, setReload] = useState(0);
  const defaults = useUserAIDefaults();
  const [model, setModel] = useState<ModelSelectorValue>({ tier: 'balanced' });
  const inFlight = useRef(false);
  const restoreLauncherFocus = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!defaults.loading) setModel(defaults.value); }, [defaults.loading, defaults.value]);
  useEffect(() => {
    let canceled = false;
    setInitializing(true);
    setHistoryError(false);
    async function resume() {
      try {
        const response = await fetch(`/api/ai/chat/sessions?courseId=${courseId}&active=true&limit=1`);
        if (!response.ok) throw new Error('Could not resume chat.');
        const data = await response.json();
        if (canceled) return;
        const key = `course-tutor:${data.userId}:${courseId}:open`;
        setStorageKey(key);
        try { setOpen(localStorage.getItem(key) === 'true'); } catch { }
        const latest = data.sessions[0];
        if (latest) {
          const response = await fetch(`/api/ai/chat/${latest._id}`);
          if (!response.ok) throw new Error('Could not resume chat.');
          const data = await response.json();
          if ((data.session.course?._id || data.session.course) !== courseId) throw new Error('Could not resume chat.');
          if (!canceled) { setSessionId(latest._id); setMessages(data.session.messages.filter((message: Message) => message.role !== ('system' as string))); }
        } else if (!canceled) { setSessionId(undefined); setMessages([]); }
      } catch {
        if (!canceled) { setError('Could not resume chat. Please retry.'); setHistoryError(true); }
      } finally { if (!canceled) setInitializing(false); }
    }
    resume();
    return () => { canceled = true; };
  }, [courseId, reload, fullPage]);
  useEffect(() => {
    let canceled = false;
    const query = new URLSearchParams({ courseId, type: page.type });
    if (page.entityId) query.set('entityId', page.entityId);
    if (page.label) query.set('label', page.label);
    fetch(`/api/ai/chat/context?${query}`).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!canceled) setFocus({ path, title: data.title });
    }).catch(() => {});
    return () => { canceled = true; };
  }, [courseId, page, path]);
  useEffect(() => {
    if (open && !hidden) inputRef.current?.focus();
    if (!open && restoreLauncherFocus.current) { launcher.current?.focus(); restoreLauncherFocus.current = false; }
  }, [open, hidden]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages, busy, open]);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    try { if (storageKey) localStorage.setItem(storageKey, String(value)); } catch { }
    if (!value) restoreLauncherFocus.current = true;
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || inFlight.current || initializing || historyError) return;
    const capturedPage = { ...page };
    inFlight.current = true;
    setBusy(true); setError(''); setInput('');
    setMessages(previous => [...previous, { role: 'user', content: question }]);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ courseId, pageContext: capturedPage, message: question, sessionId, ...model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send your question.');
      setSessionId(data.sessionId);
      setMessages(previous => [...previous, { role: 'assistant', content: data.message.content }]);
    } catch (error) {
      setMessages(previous => previous.slice(0, -1));
      setInput(question);
      setError(error instanceof Error ? error.message : 'Could not send your question. Please retry.');
    } finally { inFlight.current = false; setBusy(false); inputRef.current?.focus(); }
  };
  const newChat = async () => {
    if (inFlight.current || initializing) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/ai/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ courseId }) });
      if (!response.ok) throw new Error('Could not start a new chat. Please retry.');
      setMessages([]); setSessionId(undefined); setInput(''); setHistoryError(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not start a new chat.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const position = 'fixed z-[60] bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6';
  return <TutorVisibility.Provider value={report}><TutorFocus.Provider value={reportFocus}>
    {children}
    {!hidden && <>
      {!open && <button ref={launcher} type="button" aria-label="Open AI tutor" disabled={initializing} onClick={() => changeOpen(true)} className={`${position} right-4 min-h-12 rounded-full bg-indigo-600 px-5 text-sm font-medium text-white shadow-lg hover:bg-indigo-500 lg:right-6`}>AI tutor</button>}
      {open && <section role="region" aria-label="AI tutor" className={`${position} left-0 right-0 flex max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom))] flex-col rounded-t-xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 lg:left-auto lg:right-6 lg:w-[400px] lg:rounded-xl`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); changeOpen(false); } }}>
        <header className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-700"><h2 className="font-semibold">AI tutor</h2><div className="flex gap-2"><button type="button" disabled={busy || initializing} onClick={newChat} className="min-h-11 rounded px-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">New chat</button><button type="button" aria-label="Close AI tutor" onClick={() => changeOpen(false)} className="min-h-11 min-w-11 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button></div></header>
        <p className="border-b border-zinc-200 bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-800 dark:border-zinc-700 dark:bg-indigo-900/30 dark:text-indigo-200">Focused on: {focus?.path === path ? focus.title : page.label || (page.type === 'overview' ? 'Course overview' : `${page.type[0].toUpperCase()}${page.type.slice(1)}`)}</p>
        <div className="min-h-24 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {initializing ? <p className="text-sm text-zinc-500">Resuming chat…</p> : messages.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Ask a question about this page.</p>}
          {messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'ml-6 rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-900/30' : 'mr-2 text-sm'}>{message.role === 'assistant' ? <MarkdownContent content={message.content} /> : message.content}</div>)}
          {busy && <p role="status" className="text-sm text-zinc-500">Thinking…</p>}
          <div ref={endRef} />
        </div>
        {error && <div role="alert" className="px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}{historyError && <button type="button" onClick={() => { setError(''); setReload(value => value + 1); }} className="ml-2 underline">Retry</button>}</div>}
        <form onSubmit={send} className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-700">
          <details><summary className="cursor-pointer py-1 text-xs text-zinc-500">Model settings</summary><ModelSelector value={model} onChange={setModel} disabled={busy} /></details>
          <div className="flex items-end gap-2"><textarea ref={inputRef} aria-label="Message the tutor" rows={2} maxLength={5000} value={input} onChange={event => setInput(event.target.value)} disabled={busy || initializing || historyError} className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" /><button type="submit" disabled={busy || initializing || historyError || !input.trim()} className="min-h-11 rounded-lg bg-indigo-600 px-3 text-sm text-white disabled:opacity-50">Send</button></div>
        </form>
      </section>}
    </>}
  </TutorFocus.Provider></TutorVisibility.Provider>;
}
