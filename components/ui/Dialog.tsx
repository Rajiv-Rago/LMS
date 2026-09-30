'use client';
import { ReactNode, useEffect, useId, useRef } from 'react';

export default function Dialog({ title, onClose, children, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === ref.current && !busy) onClose(); }} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="min-h-11 min-w-11 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button></div>
    {children}
  </dialog>;
}
