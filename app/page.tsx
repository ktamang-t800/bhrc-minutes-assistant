"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import documentMeta from "./data/document-meta.json";
import { parseAnswerBlocks } from "./lib/answer-format";
import { downloadTableWorkbook } from "./lib/xlsx";

type Source = {
  documentId: string;
  meetingNumber: number;
  label: string;
  page: number;
  href: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  pending?: boolean;
  error?: boolean;
};

type AccessState = "checking" | "locked" | "ready";

const suggestedQuestions = [
  "Give me a summary of the BHRC meeting held on March 24, 2026.",
  "What decisions were recorded in the 33rd BHRC meeting?",
  "Compare the main HR matters discussed across all five meetings.",
  "How many attendees were recorded for each meeting? Show me a table.",
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function AnswerContent({
  text,
  pending = false,
}: {
  text: string;
  pending?: boolean;
}) {
  const blocks = parseAnswerBlocks(text);

  return (
    <div className="answer-copy">
      {blocks.map((block, index) => {
        if (block.type === "text") {
          return (
            <div className="answer-text" key={`text-${index}`}>
              {block.text}
            </div>
          );
        }

        const tableNumber =
          blocks.slice(0, index + 1).filter((item) => item.type === "table")
            .length;

        return (
          <section className="answer-table-card" key={`table-${index}`}>
            <div className="answer-table-toolbar">
              <span>Table</span>
              {!pending && (
                <button
                  onClick={() =>
                    downloadTableWorkbook(block.table, tableNumber)
                  }
                  type="button"
                >
                  <i aria-hidden="true">↓</i>
                  Download Excel
                </button>
              )}
            </div>
            <div className="answer-table-scroll">
              <table>
                <thead>
                  <tr>
                    {block.table.headers.map((header, headerIndex) => (
                      <th key={`${header}-${headerIndex}`} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.table.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark-compact" : ""}`}>
      <div className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>BHRC</strong>
        {!compact && <small>Archives</small>}
      </div>
    </div>
  );
}

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!passcode.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "That passcode was not accepted.");
      }
      setPasscode("");
      onUnlocked();
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Unable to unlock the assistant.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="lock-screen">
      <div className="lock-orbit lock-orbit-one" aria-hidden="true" />
      <div className="lock-orbit lock-orbit-two" aria-hidden="true" />
      <section className="lock-card">
        <BrandMark />
        <div className="lock-emblem" aria-hidden="true">
          <span className="lock-emblem-dot" />
          <span className="lock-emblem-line" />
          <span className="lock-emblem-line" />
          <span className="lock-emblem-line short" />
        </div>
        <p className="eyebrow">Private document assistant</p>
        <h1>Welcome to the minutes.</h1>
        <p className="lock-copy">
          Enter the shared passcode to ask questions across five BHRC meetings.
        </p>
        <form className="lock-form" onSubmit={unlock}>
          <label htmlFor="passcode">Shared passcode</label>
          <div className="passcode-row">
            <input
              autoComplete="current-password"
              autoFocus
              id="passcode"
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Enter passcode"
              type="password"
              value={passcode}
            />
            <button disabled={submitting || !passcode.trim()} type="submit">
              {submitting ? "Checking..." : "Continue"}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>
        <div className="lock-footnote">
          <span className="status-dot" />
          Answers are restricted to the provided source documents.
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => setAccess(response.ok ? "ready" : "locked"))
      .catch(() => setAccess("locked"));
  }, []);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({
      behavior: messages.some((message) => message.pending) ? "auto" : "smooth",
      block: "end",
    });
  }, [messages]);

  function updateAssistant(id: string, update: Partial<Message>) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...update } : message,
      ),
    );
  }

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: trimmed,
    };
    const assistantId = makeId();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
    };
    const nextMessages = [...messages, userMessage];

    setMessages([...nextMessages, assistantMessage]);
    setDraft("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
            .filter((message) => !message.error)
            .slice(-8)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      if (response.status === 401) {
        setAccess("locked");
        throw new Error("Your session expired. Enter the passcode again.");
      }

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "The assistant could not answer.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: "delta" | "sources" | "error";
            delta?: string;
            sources?: Source[];
            error?: string;
          };

          if (event.type === "delta" && event.delta) {
            answer += event.delta;
            updateAssistant(assistantId, { content: answer, pending: true });
          } else if (event.type === "sources") {
            updateAssistant(assistantId, {
              content: answer,
              sources: event.sources ?? [],
              pending: false,
            });
          } else if (event.type === "error") {
            throw new Error(event.error ?? "The answer stream was interrupted.");
          }
        }

        if (done) break;
      }

      updateAssistant(assistantId, { content: answer, pending: false });
    } catch (chatError) {
      updateAssistant(assistantId, {
        content:
          chatError instanceof Error
            ? chatError.message
            : "The assistant could not answer right now.",
        pending: false,
        error: true,
      });
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendQuestion(draft);
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(draft);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    setMessages([]);
    setAccess("locked");
  }

  if (access === "checking") {
    return (
      <main className="checking-screen">
        <BrandMark />
        <div className="checking-pulse" aria-label="Checking access" />
      </main>
    );
  }

  if (access === "locked") {
    return <LockScreen onUnlocked={() => setAccess("ready")} />;
  }

  return (
    <main className="app-shell">
      <aside className={`library-panel ${libraryOpen ? "library-open" : ""}`}>
        <div className="library-top">
          <BrandMark />
          <button
            aria-label="Close document library"
            className="close-library"
            onClick={() => setLibraryOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={() => {
            setMessages([]);
            setLibraryOpen(false);
          }}
          type="button"
        >
          <span aria-hidden="true">＋</span>
          New conversation
        </button>

        <div className="library-section">
          <div className="section-heading">
            <span>Source library</span>
            <span className="count-badge">{documentMeta.length}</span>
          </div>
          <div className="document-list">
            {documentMeta
              .slice()
              .reverse()
              .map((document) => (
                <a
                  className="document-card"
                  href={document.href}
                  key={document.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="document-number">
                    {document.meetingNumber}
                  </span>
                  <span className="document-details">
                    <strong>{document.meetingLabel}</strong>
                    <small>
                      {document.date} · {document.pageCount} pages
                    </small>
                  </span>
                  <span className="document-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              ))}
          </div>
        </div>

        <div className="library-footer">
          <div>
            <span className="status-dot" />
            <strong>Source-grounded</strong>
          </div>
          <p>Answers use these five documents only.</p>
        </div>
      </aside>

      {libraryOpen && (
        <button
          aria-label="Close document library"
          className="library-backdrop"
          onClick={() => setLibraryOpen(false)}
          type="button"
        />
      )}

      <section className="chat-panel">
        <header className="chat-header">
          <button
            aria-label="Open document library"
            className="mobile-library-button"
            onClick={() => setLibraryOpen(true)}
            type="button"
          >
            ☰
          </button>
          <div className="chat-header-title">
            <strong>BHRC Archives</strong>
            <span>
              <i className="status-dot" /> 5 meetings · 27 pages
            </span>
          </div>
          <button className="logout-button" onClick={logout} type="button">
            Lock
          </button>
        </header>

        <div className="conversation">
          {messages.length === 0 ? (
            <section className="welcome-state">
              <div className="welcome-orb" aria-hidden="true">
                <span />
                <span />
                <span />
                <b>5</b>
              </div>
              <p className="eyebrow">Five meetings. One conversation.</p>
              <h1>Ask the minutes.</h1>
              <p className="welcome-copy">
                Get clear, cited answers across 27 pages of BHRC source
                material. If it is not in the minutes, the assistant will say
                so.
              </p>
              <div className="suggestion-grid">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={question}
                    onClick={() => void sendQuestion(question)}
                    type="button"
                  >
                    <span>0{index + 1}</span>
                    {question}
                    <i aria-hidden="true">↗</i>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <article
                  className={`message message-${message.role} ${
                    message.error ? "message-error" : ""
                  }`}
                  key={message.id}
                >
                  <div className="message-avatar" aria-hidden="true">
                    {message.role === "assistant" ? "B" : "You"}
                  </div>
                  <div className="message-content">
                    <div className="message-label">
                      {message.role === "assistant"
                        ? "BHRC Archives"
                        : "You"}
                    </div>
                    {message.role === "assistant" ? (
                      <>
                        {message.content ? (
                          <AnswerContent
                            pending={message.pending}
                            text={message.content}
                          />
                        ) : (
                          <div className="thinking-dots" aria-label="Thinking">
                            <span />
                            <span />
                            <span />
                          </div>
                        )}
                        {!!message.sources?.length && (
                          <div className="source-strip">
                            <small>Sources</small>
                            <div>
                              {message.sources.map((source) => (
                                <a
                                  href={source.href}
                                  key={`${source.documentId}-${source.page}`}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <span>DOC</span>
                                  {source.label}
                                  <i aria-hidden="true">↗</i>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </article>
              ))}
              <div ref={conversationEnd} />
            </div>
          )}
        </div>

        <footer className="composer-wrap">
          <form className="composer" onSubmit={submit}>
            <textarea
              aria-label="Ask a question about the minutes"
              disabled={sending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKey}
              placeholder="Ask a question about the BHRC minutes..."
              rows={1}
              value={draft}
            />
            <button
              aria-label="Send question"
              disabled={sending || !draft.trim()}
              type="submit"
            >
              ↑
            </button>
          </form>
          <p>
            Answers are generated only from the five selected minutes and
            include a source section. Tables can be downloaded as Excel files.
          </p>
        </footer>
      </section>
    </main>
  );
}
