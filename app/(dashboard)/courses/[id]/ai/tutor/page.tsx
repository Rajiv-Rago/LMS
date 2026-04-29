"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  _id: string;
  title: string;
  createdAt: string;
}

export default function AITutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const userDefaults = useUserAIDefaults();
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });

  useEffect(() => {
    if (!userDefaults.loading) {
      setModelValue(userDefaults.value);
    }
  }, [userDefaults.loading, userDefaults.value]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(`/api/ai/chat/sessions?courseId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions);
        }
      } catch { } finally {
        setLoadingSessions(false);
      }
    }
    fetchSessions();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(sessionId);
        setMessages(
          data.session.messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          }))
        );
      }
    } catch { }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          courseId: id,
          lessonId: lessonId || undefined,
          message: userMessage,
          sessionId: currentSessionId || undefined,
          tier: modelValue.tier || undefined,
          provider: modelValue.provider || undefined,
          model: modelValue.model || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(data.sessionId);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message.content },
        ]);

        // Update sessions list if this is a new session
        if (!currentSessionId) {
          setSessions((prev) => [
            {
              _id: data.sessionId,
              title: userMessage.slice(0, 50),
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <div className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link
            href={`/courses/${id}/overview`}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            &larr; Back to course
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
            AI Tutor
          </h2>
        </div>

        <div className="p-4 space-y-3">
          <Button onClick={startNewChat} className="w-full">
            New Chat
          </Button>
          <ModelSelector
            value={modelValue}
            onChange={setModelValue}
            disabled={loading}
          />
        </div>

        <div className="flex-1 overflow-y-auto hidden lg:block">
          <div className="px-4 pb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
            Recent Chats
          </div>
          {loadingSessions ? (
            <div className="px-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              No previous chats
            </div>
          ) : (
            <ul className="space-y-1 px-2">
              {sessions.map((session) => (
                <li key={session._id}>
                  <button
                    onClick={() => loadSession(session._id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md truncate ${
                      currentSessionId === session._id
                        ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {session.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Ask me anything about this course!
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  I&apos;m here to help you understand the material better.
                </p>
                {lessonId && (
                  <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
                    Currently focused on the selected lesson.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 min-h-[44px]"
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
