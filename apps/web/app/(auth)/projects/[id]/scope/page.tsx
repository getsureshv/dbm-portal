'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { projects as projectsApi, ApiProject } from '../../../../../lib/api';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
}

interface FieldUpdate {
  field: string;
  value: string;
}

export default function ScopeArchitectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load project data
  useEffect(() => {
    projectsApi
      .get(params.id)
      .then((p) => {
        setProject(p);
        // Add initial assistant greeting
        setMessages([
          {
            id: 'welcome',
            type: 'assistant',
            content: `Hi! I'm the AI Scope Architect for "${p.title}". I'll help you build a comprehensive Scope of Work through a quick interview. Let's start — can you describe the main goal of this project? What are you looking to accomplish?`,
          },
        ]);
      })
      .catch((err) => setProjectError(err.message || 'Failed to load project'))
      .finally(() => setLoadingProject(false));
  }, [params.id]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setChatError(null);

    // Add a placeholder assistant message that we'll stream into
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, type: 'assistant', content: '' }]);

    try {
      const res = await fetch(`/api/chat/scope/${params.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.status === 503) {
        setAiUnavailable(true);
        // Remove the empty assistant placeholder
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsStreaming(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.message || `Error ${res.status}`);
      }

      // Parse SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No response stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'text_delta') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.content } : m,
                ),
              );
            } else if (event.type === 'complete' && event.fieldUpdates?.length > 0) {
              // Refresh project to get updated scope document
              projectsApi.get(params.id).then(setProject).catch(() => {});
            } else if (event.type === 'error') {
              setChatError(event.error);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err: any) {
      setChatError(err.message || 'Failed to send message');
      // Remove empty assistant placeholder on error
      setMessages((prev) => {
        const msg = prev.find((m) => m.id === assistantId);
        if (msg && !msg.content) return prev.filter((m) => m.id !== assistantId);
        return prev;
      });
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  if (loadingProject) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>{projectError || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  const scope = project.scopeDocument;
  const completeness = scope?.completenessPercent ?? 0;

  // Collect populated scope fields for display
  const scopeSections: { label: string; value: string | null }[] = [
    { label: 'Project Scope', value: scope?.projectScope ?? null },
    { label: 'Dimensions & Specifications', value: scope?.dimensions ?? null },
    { label: 'Materials & Grade', value: scope?.materialGrade ?? null },
    { label: 'Timeline', value: scope?.timeline ?? null },
    { label: 'Milestones', value: scope?.milestones ?? null },
    { label: 'Special Conditions', value: scope?.specialConditions ?? null },
    { label: 'Preferred Start Date', value: scope?.preferredStartDate ?? null },
    { label: 'Site Constraints', value: scope?.siteConstraints ?? null },
    { label: 'Aesthetic Preferences', value: scope?.aestheticPreferences ?? null },
  ];

  const populatedSections = scopeSections.filter((s) => s.value);
  const emptySections = scopeSections.filter((s) => !s.value);

  return (
    <div className="flex h-full bg-gradient-to-br from-navy via-navy-dark to-navy-light">
      {/* Left Panel - SOW Preview (60%) */}
      <div className="w-3/5 border-r border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/5 border-b border-white/10 p-4 flex items-center justify-between">
          <Link
            href={`/projects/${params.id}`}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={14} />
            Back to Project
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="text-gold" size={16} />
            <span className="text-sm font-medium text-white">AI Scope Architect</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/5 border-b border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-white">Scope Completeness</h2>
            <span className="text-sm text-gold font-medium">{completeness}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold to-gold/70 transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
          {completeness >= 65 && (
            <p className="text-xs text-green-400 mt-2">
              Scope is ready for PDF generation
            </p>
          )}
        </div>

        {/* SOW Preview */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Scope of Work</h1>
            <p className="text-white/60 text-sm">{project.title} &mdash; {project.type}</p>
          </div>

          {/* Populated Sections */}
          {populatedSections.map((section) => (
            <section key={section.label}>
              <h2 className="text-lg font-semibold text-gold mb-3">{section.label}</h2>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {section.value}
                </p>
              </div>
            </section>
          ))}

          {/* Empty Sections */}
          {emptySections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wide">
                Still Needed
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {emptySections.map((section) => (
                  <div
                    key={section.label}
                    className="bg-white/5 border border-dashed border-white/10 rounded-lg p-3"
                  >
                    <p className="text-white/30 text-xs">{section.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {populatedSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="text-gold/30 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-white/60 mb-2">No scope data yet</h3>
              <p className="text-sm text-white/40 max-w-sm">
                Start chatting with the AI Scope Architect to build your Scope of Work.
                Answer questions about your project and watch the scope fill in here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat (40%) */}
      <div className="w-2/5 flex flex-col bg-white/5">
        {/* AI Unavailable Warning */}
        {aiUnavailable && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-4 flex items-start gap-3">
            <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
            <div className="text-sm">
              <p className="font-medium text-yellow-400">AI features unavailable</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                The ANTHROPIC_API_KEY environment variable is not configured on the server.
              </p>
            </div>
          </div>
        )}

        {/* Chat Error */}
        {chatError && (
          <div className="bg-red-500/10 border-b border-red-500/20 p-3 flex items-center gap-2">
            <AlertCircle className="text-red-400 flex-shrink-0" size={14} />
            <p className="text-red-400 text-xs">{chatError}</p>
            <button
              onClick={() => setChatError(null)}
              className="ml-auto text-red-400/60 hover:text-red-400 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-gold text-navy rounded-br-none'
                    : 'bg-white/10 text-white rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                  {isStreaming && message.type === 'assistant' && message === messages[messages.length - 1] && !message.content && (
                    <span className="inline-flex gap-1 ml-1">
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-white/10 p-6 space-y-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus-within:border-gold/30 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={aiUnavailable ? 'AI is not available...' : 'Describe your project scope...'}
              disabled={aiUnavailable || isStreaming}
              className="flex-1 bg-transparent text-white placeholder-white/40 outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isStreaming || aiUnavailable}
              className="text-gold hover:text-gold/80 disabled:text-white/20 transition-colors"
            >
              {isStreaming ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="text-xs text-white/40">
            {isStreaming
              ? 'AI is thinking...'
              : 'Describe your project details and the AI will build your scope of work.'}
          </p>
        </div>
      </div>
    </div>
  );
}
