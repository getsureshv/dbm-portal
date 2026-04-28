'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, AlertCircle, Loader2, ArrowLeft, Sparkles, Mic, MicOff, Pencil, Plus, FileDown, CheckCircle2 } from 'lucide-react';
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

/**
 * Strip hidden tags from AI responses so the user only sees conversational text.
 * Removes: <scope_update>, <options>, JSON code blocks, field_update JSON objects.
 */
function cleanAssistantMessage(text: string): string {
  let cleaned = text;

  // Remove <scope_update field="...">...</scope_update>
  cleaned = cleaned.replace(/<scope_update\s+field="[^"]*">[\s\S]*?<\/scope_update>/g, '');

  // Remove <options>...</options>
  cleaned = cleaned.replace(/<options>[\s\S]*?<\/options>/g, '');

  // Remove JSON code blocks
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '');

  // Remove standalone field_update JSON
  cleaned = cleaned.replace(/\{\s*"type"\s*:\s*"field_update"[\s\S]*?\}/g, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Extract quick-reply options from <options>opt1|opt2|opt3</options> tag.
 */
function extractOptions(text: string): string[] {
  const match = text.match(/<options>([\s\S]*?)<\/options>/);
  if (!match) return [];

  return match[1]
    .split('|')
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && o.length < 80);
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
  const [quickOptions, setQuickOptions] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load project data
  useEffect(() => {
    projectsApi
      .get(params.id)
      .then((p) => {
        setProject(p);
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

  // Re-focus input after streaming completes
  useEffect(() => {
    if (!isStreaming && !aiUnavailable) {
      // Small delay so the disabled prop clears first
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, aiUnavailable]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    setVoiceSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show interim results in the input as the user speaks
      if (interimTranscript) {
        setInput((prev) => {
          // Replace any previous interim text (after last final segment)
          return finalTranscript || interimTranscript;
        });
      }

      if (finalTranscript) {
        setInput(finalTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setChatError('Microphone access denied. Please allow microphone permissions.');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Section definitions with field keys and chat prompts
  const SCOPE_SECTIONS: Array<{
    fieldKey: string;
    label: string;
    emptyPrompt: string;
    editPrompt: string;
  }> = [
    {
      fieldKey: 'projectScope',
      label: 'Project Scope',
      emptyPrompt: "Let's define the overall project scope. What's the main goal of this project?",
      editPrompt: "I'd like to update the project scope. Here's what I want to change:",
    },
    {
      fieldKey: 'dimensions',
      label: 'Dimensions & Specifications',
      emptyPrompt: "Let's talk about dimensions and specifications. What are the measurements of the space?",
      editPrompt: "I need to update the dimensions and specifications:",
    },
    {
      fieldKey: 'materialGrade',
      label: 'Materials & Grade',
      emptyPrompt: "Let's discuss materials. What quality level and materials are you considering?",
      editPrompt: "I want to change the materials selection:",
    },
    {
      fieldKey: 'timeline',
      label: 'Timeline',
      emptyPrompt: "Let's set the project timeline. How long do you expect this project to take?",
      editPrompt: "I need to adjust the timeline:",
    },
    {
      fieldKey: 'milestones',
      label: 'Milestones',
      emptyPrompt: "Let's define project milestones. What are the key phases or checkpoints?",
      editPrompt: "I want to update the project milestones:",
    },
    {
      fieldKey: 'specialConditions',
      label: 'Special Conditions',
      emptyPrompt: "Are there any special conditions? Think permits, HOA rules, structural concerns, or unique requirements.",
      editPrompt: "I need to update the special conditions:",
    },
    {
      fieldKey: 'preferredStartDate',
      label: 'Preferred Start Date',
      emptyPrompt: "When would you ideally like the project to start?",
      editPrompt: "I want to change the preferred start date:",
    },
    {
      fieldKey: 'siteConstraints',
      label: 'Site Constraints',
      emptyPrompt: "Let's discuss site constraints. Any access issues, parking, neighbors, pets, or occupancy during work?",
      editPrompt: "I need to update the site constraints:",
    },
    {
      fieldKey: 'aestheticPreferences',
      label: 'Aesthetic Preferences',
      emptyPrompt: "Let's talk aesthetics. What style, colors, or design feel are you going for?",
      editPrompt: "I'd like to update my aesthetic preferences:",
    },
  ];

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Stop voice recognition if active
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        type: 'user',
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsStreaming(true);
      setChatError(null);
      setQuickOptions([]);

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, type: 'assistant', content: '' }]);

      try {
        const res = await fetch(`/api/chat/scope/${params.id}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text.trim() }),
        });

        if (res.status === 503) {
          setAiUnavailable(true);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setIsStreaming(false);
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || err.message || `Error ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        if (!reader) throw new Error('No response stream');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'text_delta') {
                fullContent += event.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.content } : m,
                  ),
                );
              } else if (event.type === 'complete') {
                if (event.fieldUpdates?.length > 0) {
                  // Track which fields were just updated for highlight animation
                  const updatedFields = new Set<string>(
                    event.fieldUpdates.map((u: FieldUpdate) => u.field),
                  );
                  setRecentlyUpdated(updatedFields);

                  // Clear highlight after 3 seconds
                  setTimeout(() => setRecentlyUpdated(new Set()), 3000);

                  // Clear active section since it was just updated
                  if (activeSection && updatedFields.has(activeSection)) {
                    setActiveSection(null);
                  }

                  // Refresh project data to get updated scope
                  projectsApi.get(params.id).then(setProject).catch(() => {});
                }
                // Extract quick options from the full response
                const opts = extractOptions(fullContent);
                if (opts.length > 0) {
                  setQuickOptions(opts);
                }
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
        setMessages((prev) => {
          const msg = prev.find((m) => m.id === assistantId);
          if (msg && !msg.content) return prev.filter((m) => m.id !== assistantId);
          return prev;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, params.id],
  );

  const handleSendMessage = () => sendMessage(input);

  const handleOptionClick = (option: string) => {
    setQuickOptions([]);
    sendMessage(option);
  };

  const handleSectionClick = useCallback(
    (fieldKey: string, hasValue: boolean) => {
      if (isStreaming) return;

      const section = SCOPE_SECTIONS.find((s) => s.fieldKey === fieldKey);
      if (!section) return;

      setActiveSection(fieldKey);

      const prompt = hasValue ? section.editPrompt : section.emptyPrompt;
      sendMessage(prompt);
    },
    [isStreaming, sendMessage],
  );

  // Detect if PDF already exists
  useEffect(() => {
    if (project?.scopeDocument?.pdfS3Key) {
      setPdfReady(true);
    }
  }, [project]);

  const handleGeneratePdf = useCallback(async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      await projectsApi.generateScopePdf(params.id);
      setPdfReady(true);
      // Refresh project to get updated pdfS3Key
      projectsApi.get(params.id).then(setProject).catch(() => {});
    } catch (err: any) {
      setPdfError(err.message || 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  }, [generatingPdf, params.id]);

  const handleDownloadPdf = useCallback(() => {
    // Open the PDF download URL in a new tab
    window.open(`/api/projects/${params.id}/scope/pdf`, '_blank');
  }, [params.id]);

  if (loadingProject) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-amber-600" size={32} />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          <span>{projectError || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  const scope = project.scopeDocument;
  const completeness = scope?.completenessPercent ?? 0;

  // Map field keys to current scope values
  const scopeFieldValues: Record<string, string | null> = {
    projectScope: scope?.projectScope ?? null,
    dimensions: scope?.dimensions ?? null,
    materialGrade: scope?.materialGrade ?? null,
    timeline: scope?.timeline ?? null,
    milestones: scope?.milestones ?? null,
    specialConditions: scope?.specialConditions ?? null,
    preferredStartDate: scope?.preferredStartDate ?? null,
    siteConstraints: scope?.siteConstraints ?? null,
    aestheticPreferences: scope?.aestheticPreferences ?? null,
  };

  const populatedSections = SCOPE_SECTIONS.filter((s) => scopeFieldValues[s.fieldKey]);
  const emptySections = SCOPE_SECTIONS.filter((s) => !scopeFieldValues[s.fieldKey]);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Panel - SOW Preview (60%) */}
      <div className="w-3/5 border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <Link
            href={`/projects/${params.id}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm"
          >
            <ArrowLeft size={14} />
            Back to Project
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-600" size={16} />
            <span className="text-sm font-medium text-gray-900">AI Scope Architect</span>
          </div>
        </div>

        {/* Progress Bar + PDF Actions */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Scope Completeness</h2>
            <span className="text-sm text-amber-600 font-medium">{completeness}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
          {completeness >= 65 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 size={12} />
                Scope is ready for PDF generation
              </p>
              <div className="flex items-center gap-2">
                {pdfReady && (
                  <button
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                      bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileDown size={13} />
                    Download PDF
                  </button>
                )}
                <button
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                    bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingPdf ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Generating...
                    </>
                  ) : pdfReady ? (
                    <>
                      <FileDown size={13} />
                      Regenerate PDF
                    </>
                  ) : (
                    <>
                      <FileDown size={13} />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          {pdfError && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle size={12} />
              {pdfError}
            </p>
          )}
        </div>

        {/* SOW Preview */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Scope of Work</h1>
            <p className="text-gray-500 text-sm">{project.title} &mdash; {project.type}</p>
          </div>

          {populatedSections.map((section) => {
            const isActive = activeSection === section.fieldKey;
            const isUpdated = recentlyUpdated.has(section.fieldKey);
            return (
              <section
                key={section.fieldKey}
                onClick={() => handleSectionClick(section.fieldKey, true)}
                className={`group cursor-pointer rounded-xl transition-all duration-300 ${
                  isUpdated
                    ? 'ring-2 ring-amber-400 animate-pulse'
                    : isActive
                      ? 'ring-2 ring-amber-300'
                      : 'hover:ring-1 hover:ring-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-amber-600">{section.label}</h2>
                  <span
                    className={`flex items-center gap-1 text-xs transition-opacity ${
                      isActive
                        ? 'text-amber-600 opacity-100'
                        : 'text-gray-300 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Pencil size={12} />
                    {isActive ? 'Editing...' : 'Click to edit'}
                  </span>
                </div>
                <div
                  className={`border rounded-lg p-4 transition-colors ${
                    isUpdated
                      ? 'bg-amber-50 border-amber-300'
                      : isActive
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-gray-200 shadow-sm group-hover:shadow-md'
                  }`}
                >
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {scopeFieldValues[section.fieldKey]}
                  </p>
                </div>
              </section>
            );
          })}

          {emptySections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                Still Needed — click to start
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {emptySections.map((section) => {
                  const isActive = activeSection === section.fieldKey;
                  const isUpdated = recentlyUpdated.has(section.fieldKey);
                  return (
                    <button
                      key={section.fieldKey}
                      onClick={() => handleSectionClick(section.fieldKey, false)}
                      disabled={isStreaming}
                      className={`text-left border rounded-lg p-3 transition-all duration-300 group ${
                        isUpdated
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
                          : isActive
                            ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                            : 'bg-gray-50 border-dashed border-gray-300 hover:border-amber-300 hover:bg-amber-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-xs ${isActive ? 'text-amber-600' : 'text-gray-400 group-hover:text-gray-500'}`}>
                          {section.label}
                        </p>
                        <Plus
                          size={12}
                          className={`transition-opacity ${
                            isActive ? 'text-amber-600 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {populatedSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="text-amber-300 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">No scope data yet</h3>
              <p className="text-sm text-gray-400 max-w-sm">
                Start chatting with the AI Scope Architect to build your Scope of Work.
                Answer questions about your project and watch the scope fill in here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat (40%) */}
      <div className="w-2/5 flex flex-col bg-gray-50">
        {/* AI Unavailable Warning */}
        {aiUnavailable && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
            <div className="text-sm">
              <p className="font-medium text-amber-700">AI features unavailable</p>
              <p className="text-amber-600 text-xs mt-1">
                The ANTHROPIC_API_KEY environment variable is not configured on the server.
              </p>
            </div>
          </div>
        )}

        {/* Chat Error */}
        {chatError && (
          <div className="bg-red-50 border-b border-red-200 p-3 flex items-center gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0" size={14} />
            <p className="text-red-600 text-xs">{chatError}</p>
            <button
              onClick={() => setChatError(null)}
              className="ml-auto text-red-400 hover:text-red-600 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {messages.map((message, idx) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-amber-500 text-white rounded-br-none'
                    : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.type === 'assistant'
                    ? cleanAssistantMessage(message.content)
                    : message.content}
                  {isStreaming &&
                    message.type === 'assistant' &&
                    idx === messages.length - 1 &&
                    !message.content && (
                      <span className="inline-flex gap-1 ml-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
                        <span
                          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <span
                          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: '0.4s' }}
                        />
                      </span>
                    )}
                </p>
              </div>
            </div>
          ))}

          {/* Quick Reply Options */}
          {quickOptions.length > 0 && !isStreaming && (
            <div className="flex flex-wrap gap-2 pt-2">
              {quickOptions.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionClick(option)}
                  className="px-4 py-2 text-sm rounded-full border border-amber-300 text-amber-700
                    bg-amber-50 hover:bg-amber-100 hover:border-amber-400
                    transition-all duration-200 active:scale-95"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-gray-200 p-6 space-y-3">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-3 focus-within:border-amber-500 transition-colors">
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
              className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none disabled:opacity-50"
              autoFocus
            />
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                disabled={isStreaming || aiUnavailable}
                className={`transition-colors ${
                  isListening
                    ? 'text-red-500 hover:text-red-400 animate-pulse'
                    : 'text-gray-400 hover:text-gray-600'
                } disabled:text-gray-300`}
                title={isListening ? 'Stop recording' : 'Voice input'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isStreaming || aiUnavailable}
              className="text-amber-600 hover:text-amber-500 disabled:text-gray-300 transition-colors"
            >
              {isStreaming ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {isStreaming
              ? 'AI is thinking...'
              : isListening
                ? '🎙️ Listening... speak now, then press send'
                : quickOptions.length > 0
                  ? `Tap an option above${voiceSupported ? ', use voice 🎙️,' : ''} or type your own answer`
                  : `Describe your project details${voiceSupported ? ' — type or use voice 🎙️' : ''}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
