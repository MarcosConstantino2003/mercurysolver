import { useEffect, useRef, useState } from 'react'
import {
  FiLinkedin,
  FiGithub,
  FiMoon,
  FiSun,
  FiSend,
  FiPlus,
  FiSidebar,
  FiMessageCircle,
  FiClock,
  FiStar,
  FiUser,
  FiFileText,
  FiUploadCloud,
  FiX,
  FiEdit3,
} from 'react-icons/fi'
import './App.css'

const mathSymbols = [
  'π', '∞', '√', '∑', '∫', '∆', '≈', '≠', '≤', '≥',
  '+', '−', '×', '÷', '=', '%', '^', '(', ')', '[',
  ']', '{', '}', '|', 'θ', 'α', 'β', 'γ', 'λ', 'μ',
  'sin', 'cos', 'tan', 'log', 'ln', 'x²', 'x³', '10^', 'e^', '→',
]

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState([])
  const [isMathKeyboardOpen, setIsMathKeyboardOpen] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const hasMessages = messages.length > 0
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const chatMessagesRef = useRef(null)
  const attachmentsSnapshotRef = useRef({ messages: [], pending: [] })

  const isAllowedFile = (file) => {
    return file.type.startsWith('image/') || file.type === 'application/pdf'
  }

  const createAttachment = (file) => {
    return {
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      file,
    }
  }

  const revokeAttachments = (attachments) => {
    attachments.forEach((attachment) => {
      URL.revokeObjectURL(attachment.url)
    })
  }

  const addAttachments = (fileList) => {
    const nextAttachments = Array.from(fileList)
      .filter(isAllowedFile)
      .map(createAttachment)

    if (nextAttachments.length === 0) return

    setPendingAttachments((current) => [...current, ...nextAttachments])
  }

  const toggleTheme = () => {
    setDarkMode(!darkMode)
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('No se pudo procesar el archivo'))
          return
        }

        const [, base64Data = ''] = reader.result.split(',')
        resolve(base64Data)
      }

      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  const buildHistoryPayload = () => {
    return messages
      .map((chatMessage) => {
        const hasText = typeof chatMessage.text === 'string' && chatMessage.text.trim().length > 0
        const hasAttachments = Array.isArray(chatMessage.attachments) && chatMessage.attachments.length > 0

        if (!hasText && !hasAttachments) return null

        const attachmentSummary = hasAttachments
          ? `Adjuntos enviados: ${chatMessage.attachments.map((attachment) => attachment.name).join(', ')}`
          : ''

        return {
          role: chatMessage.role,
          text: hasText
            ? chatMessage.text.trim()
            : attachmentSummary,
        }
      })
      .filter(Boolean)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (isSending) return

    const textMessage = message.trim()
    const attachmentsToSend = pendingAttachments

    if (!textMessage && attachmentsToSend.length === 0) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: textMessage,
      attachments: attachmentsToSend,
    }

    setMessages((currentMessages) => [...currentMessages, userMessage])
    setMessage('')
    setPendingAttachments([])

    setIsSending(true)

    try {
      const attachmentsPayload = await Promise.all(
        attachmentsToSend.map(async (attachment) => ({
          name: attachment.name,
          mimeType: attachment.type,
          data: await fileToBase64(attachment.file),
        })),
      )

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textMessage,
          history: buildHistoryPayload(),
          attachments: attachmentsPayload,
        }),
      })

      const raw = await response.text()
      let result = null

      if (raw) {
        try {
          result = JSON.parse(raw)
        } catch {
          result = { error: raw }
        }
      }

      if (!response.ok) {
        throw new Error(result?.error || `Error HTTP ${response.status}`)
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: result?.text || 'No recibí respuesta de Gemini.',
          attachments: [],
        },
      ])
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now() + 2,
          role: 'assistant',
          text: `No pude obtener respuesta: ${error.message}`,
          attachments: [],
        },
      ])
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleNewChat = () => {
    const messageAttachments = messages.flatMap((chatMessage) => chatMessage.attachments || [])
    revokeAttachments(messageAttachments)
    revokeAttachments(pendingAttachments)

    setMessages([])
    setMessage('')
    setPendingAttachments([])

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handlePickFiles = (e) => {
    if (!e.target.files) return
    addAttachments(e.target.files)
    e.target.value = ''
  }

  const handleRemovePendingAttachment = (attachmentId) => {
    setPendingAttachments((current) => {
      const attachmentToRemove = current.find((attachment) => attachment.id === attachmentId)

      if (attachmentToRemove) {
        URL.revokeObjectURL(attachmentToRemove.url)
      }

      return current.filter((attachment) => attachment.id !== attachmentId)
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragActive(false)

    if (e.dataTransfer.files?.length) {
      addAttachments(e.dataTransfer.files)
    }
  }

  const insertMathSymbol = (symbol) => {
    const input = inputRef.current
    if (!input) {
      setMessage((currentMessage) => `${currentMessage}${symbol}`)
      return
    }

    const selectionStart = input.selectionStart ?? message.length
    const selectionEnd = input.selectionEnd ?? message.length

    setMessage((currentMessage) => {
      const before = currentMessage.slice(0, selectionStart)
      const after = currentMessage.slice(selectionEnd)
      return `${before}${symbol}${after}`
    })

    requestAnimationFrame(() => {
      const nextCursor = selectionStart + symbol.length
      input.focus()
      input.setSelectionRange(nextCursor, nextCursor)
    })
  }

  useEffect(() => {
    attachmentsSnapshotRef.current = { messages, pending: pendingAttachments }
  }, [messages, pendingAttachments])

  useEffect(() => {
    if (!hasMessages || !chatMessagesRef.current) return

    requestAnimationFrame(() => {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    })
  }, [messages, hasMessages])

  useEffect(() => {
    return () => {
      const messageAttachments = attachmentsSnapshotRef.current.messages.flatMap(
        (chatMessage) => chatMessage.attachments || [],
      )

      revokeAttachments(messageAttachments)
      revokeAttachments(attachmentsSnapshotRef.current.pending)
    }
  }, [])

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <div className="app-shell">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label="Toggle sidebar"
          >
            <FiSidebar />
          </button>

          <nav className="sidebar-nav" aria-label="Sidebar navigation">
            <button className="sidebar-item" type="button" onClick={handleNewChat}>
              <FiMessageCircle />
              {!sidebarCollapsed && <span>Nuevo chat</span>}
            </button>
            <button className="sidebar-item" type="button">
              <FiClock />
              {!sidebarCollapsed && <span>Recientes</span>}
            </button>
          </nav>

          <div className="sidebar-footer-actions">
            <button className="sidebar-item sidebar-star" type="button">
              <FiStar />
              {!sidebarCollapsed && <span>Premium</span>}
            </button>

            <button className="sidebar-item sidebar-profile" type="button" aria-label="Perfil (próximamente)">
              <FiUser />
              {!sidebarCollapsed && <span>Perfil</span>}
            </button>
          </div>
        </aside>

        <div className="main-area">
          <header className="header">
            <div className="logo-container">
              <div className="logo-icon">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="mercuryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6d28d9" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="45" fill="url(#mercuryGradient)" opacity="0.15" />
                  <path
                    d="M50 12 L68 35 L83 31 L64 55 L73 55 L50 88 L41 61 L27 65 L40 41 L31 36 Z"
                    fill="url(#mercuryGradient)"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <circle cx="50" cy="25" r="7" fill="#ffffff" opacity="0.95" />
                </svg>
              </div>
              <h1 className="logo-text">MercurySolver</h1>
            </div>

            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {darkMode ? <FiSun /> : <FiMoon />}
            </button>
          </header>

          <main className={`chat-container ${hasMessages ? 'has-messages' : 'no-messages'}`}>
            {!hasMessages ? (
              <section className="welcome-only" aria-live="polite">
                <h2>Bienvenido</h2>
              </section>
            ) : (
              <section className="chat-messages" aria-live="polite" ref={chatMessagesRef}>
                {messages.map((chatMessage) => (
                  <article
                    key={chatMessage.id}
                    className={`message-item ${chatMessage.role === 'assistant' ? 'assistant' : 'user'}`}
                  >
                    {chatMessage.text && <p className="message-text">{chatMessage.text}</p>}

                    {chatMessage.attachments?.length > 0 && (
                      <div className="message-attachments">
                        {chatMessage.attachments.map((attachment) => {
                          const isImage = attachment.type.startsWith('image/')

                          if (isImage) {
                            return (
                              <img
                                key={attachment.id}
                                src={attachment.url}
                                alt={attachment.name}
                                className="message-image"
                              />
                            )
                          }

                          return (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="message-pdf"
                            >
                              <FiFileText />
                              <span>{attachment.name}</span>
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </article>
                ))}

                {isSending && (
                  <article className="message-item assistant typing">
                    <p className="message-text">Gemini está escribiendo…</p>
                  </article>
                )}
              </section>
            )}

            <form className="composer" onSubmit={handleSendMessage}>
              {!hasMessages && (
                <div
                  className={`drop-zone ${isDragActive ? 'active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragActive(true)
                  }}
                  onDragLeave={() => setIsDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  <FiUploadCloud className="drop-zone-icon" />
                  <span>Arrastar foto o PDF.</span>
                  {pendingAttachments.length > 0 && (
                    <small>{pendingAttachments.length} archivo(s) listo(s) para enviar</small>
                  )}
                </div>
              )}

              <div
                className={`input-container ${isDragActive ? 'drag-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragActive(true)
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handlePickFiles}
                  hidden
                />

                <div className="attach-wrapper">
                  <button
                    type="button"
                    className="attach-button"
                    aria-label="Adjuntar archivo"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FiPlus />
                  </button>
                  <span className="attach-tooltip">Adjuntar imagen/PDF</span>
                </div>

                {pendingAttachments.length > 0 && (
                  <div className="pending-attachments" aria-label="Archivos adjuntos listos">
                    {pendingAttachments.map((attachment) => (
                      <span key={attachment.id} className="pending-attachment-chip">
                        <span className="pending-attachment-name">{attachment.name}</span>
                        <button
                          type="button"
                          className="remove-attachment"
                          aria-label={`Quitar ${attachment.name}`}
                          onClick={() => handleRemovePendingAttachment(attachment.id)}
                        >
                          <FiX />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  className="message-input"
                />
                <button
                  type="submit"
                  className="send-button"
                  aria-label="Send message"
                  disabled={isSending}
                >
                  <FiSend />
                </button>
              </div>

              <button
                type="button"
                className={`math-toggle-button ${isMathKeyboardOpen ? 'active' : ''}`}
                onClick={() => setIsMathKeyboardOpen((currentState) => !currentState)}
              >
                <FiEdit3 />
                <span>Math Input</span>
              </button>

              {isMathKeyboardOpen && (
                <div className="math-keyboard" aria-label="Teclado matemático">
                  {mathSymbols.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      className="math-key"
                      onClick={() => insertMathSymbol(symbol)}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </main>
        </div>
      </div>

      <div className="floating-card" aria-label="Marcos Constantino links">
        <div className="floating-card-content">
          <p className="copyright">Marcos Constantino © 2026</p>
          <div className="social-links">
            <a
              href="https://www.linkedin.com/in/marquitosconstantino"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <FiLinkedin />
            </a>
            <a
              href="https://github.com/MarcosConstantino2003"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <FiGithub />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
