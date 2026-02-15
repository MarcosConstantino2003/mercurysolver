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
  FiLogOut,
  FiLogIn,
} from 'react-icons/fi'
import { FaGoogle } from 'react-icons/fa'
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
  const [user, setUser] = useState(null)
  const [activeView, setActiveView] = useState('chat')
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    verifyCode: '',
    name: '',
    birthYear: '',
    currentPassword: '',
    newPassword: '',
  })
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
  const isAuthenticated = Boolean(user?.email)

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

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
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

    return result
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

  const handleAuthInput = (field, value) => {
    setAuthForm((current) => ({ ...current, [field]: value }))
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    console.info('[AUTH][REGISTER] Intentando registro', { email: authForm.email })
    setAuthNotice('')
    setAuthLoading(true)

    try {
      const result = await requestJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      })

      setAuthMode('verify')
      setAuthNotice(result?.message || 'Código enviado a tu mail')
      console.info('[AUTH][REGISTER] Registro OK, código enviado')
    } catch (error) {
      console.error('[AUTH][REGISTER] Error en registro', error)
      setAuthNotice(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    console.info('[AUTH][VERIFY] Intentando verificación', { email: authForm.email })
    setAuthNotice('')
    setAuthLoading(true)

    try {
      const result = await requestJson('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          email: authForm.email,
          code: authForm.verifyCode,
        }),
      })

      setAuthMode('login')
      setAuthNotice(result?.message || 'Cuenta verificada, ya puedes iniciar sesión')
      setAuthForm((current) => ({ ...current, verifyCode: '' }))
      console.info('[AUTH][VERIFY] Verificación OK')
    } catch (error) {
      console.error('[AUTH][VERIFY] Error en verificación', error)
      setAuthNotice(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    console.info('[AUTH][LOGIN] Intentando login', { email: authForm.email })
    setAuthNotice('')
    setAuthLoading(true)

    try {
      const result = await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      })

      setUser(result?.user || null)
      setShowProfilePanel(false)
      setActiveView('chat')
      setAuthNotice('')
      console.info('[AUTH][LOGIN] Login OK')
    } catch (error) {
      console.error('[AUTH][LOGIN] Error en login', error)
      setAuthNotice(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    console.info('[AUTH][LOGOUT] Ejecutando logout')
    try {
      await requestJson('/api/auth/logout', { method: 'POST', body: '{}' })
    } catch {
      // noop
    }

    setUser(null)
    setShowProfilePanel(false)
    setActiveView('chat')
    setMessages([])
    setMessage('')
    setPendingAttachments([])
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileNotice('')
    setProfileLoading(true)

    try {
      const result = await requestJson('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: authForm.name,
          birthYear: authForm.birthYear || null,
        }),
      })

      setUser(result?.user || user)
      setProfileNotice('Perfil actualizado')
    } catch (error) {
      setProfileNotice(error.message)
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setProfileNotice('')
    setProfileLoading(true)

    try {
      const result = await requestJson('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: authForm.currentPassword,
          newPassword: authForm.newPassword,
        }),
      })

      setProfileNotice(result?.message || 'Contraseña actualizada')
      setAuthForm((current) => ({ ...current, currentPassword: '', newPassword: '' }))
    } catch (error) {
      setProfileNotice(error.message)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleNewChat = () => {
    const messageAttachments = messages.flatMap((chatMessage) => chatMessage.attachments || [])
    revokeAttachments(messageAttachments)
    revokeAttachments(pendingAttachments)

    setActiveView('chat')
    setShowProfilePanel(false)
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
    const bootstrapSession = async () => {
      try {
        const result = await requestJson('/api/auth/me', { method: 'GET' })
        if (result?.user) {
          setUser(result.user)
          setAuthForm((current) => ({
            ...current,
            email: result.user.email || current.email,
            name: result.user.name || '',
            birthYear: result.user.birthYear || '',
          }))
        }
      } catch {
        // no session
      }
    }

    bootstrapSession()
  }, [])

  useEffect(() => {
    if (!user) return
    setAuthForm((current) => ({
      ...current,
      email: user.email || current.email,
      name: user.name || '',
      birthYear: user.birthYear || '',
    }))
  }, [user])

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

            {!isAuthenticated ? (
              <button
                className="sidebar-item sidebar-login"
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthNotice('')
                  setActiveView('auth')
                }}
              >
                <FiLogIn />
                {!sidebarCollapsed && <span>Log in</span>}
              </button>
            ) : (
              <>
                <button
                  className="sidebar-item sidebar-profile"
                  type="button"
                  aria-label="Perfil"
                  onClick={() => setShowProfilePanel((current) => !current)}
                >
                  <FiUser />
                  {!sidebarCollapsed && <span>Perfil</span>}
                </button>

                <button className="sidebar-item sidebar-logout" type="button" onClick={handleLogout}>
                  <FiLogOut />
                  {!sidebarCollapsed && <span>Log out</span>}
                </button>
              </>
            )}
          </div>
        </aside>

        <div className="main-area">
          <header className="header">
            <button className="logo-container" type="button" onClick={handleNewChat}>
              <span className="logo-image-stack" aria-hidden="true">
                <img src="/whitelogo.png" alt="" className="logo-image logo-image-light" />
                <img src="/fulllogo.png" alt="" className="logo-image logo-image-dark" />
              </span>
            </button>

            <div className="header-actions">
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                {darkMode ? <FiSun /> : <FiMoon />}
              </button>
            </div>
          </header>

          {activeView === 'auth' && !isAuthenticated ? (
            <main className="auth-page">
              <div className="auth-page-top-tabs">
                <button
                  type="button"
                  className={`auth-top-tab ${authMode === 'login' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthMode('login')
                    setAuthNotice('')
                  }}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className={`auth-top-tab ${authMode === 'register' || authMode === 'verify' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthMode('register')
                    setAuthNotice('')
                  }}
                >
                  Registrarse
                </button>
              </div>

              <section className="auth-card auth-page-card">
                <h2>
                  {authMode === 'register'
                    ? 'Crear cuenta'
                    : authMode === 'verify'
                      ? 'Verificar código'
                      : 'Iniciar sesión'}
                </h2>

                {authNotice && <p className="auth-notice">{authNotice}</p>}

                {authMode === 'register' && (
                  <form className="auth-form" onSubmit={handleRegister}>
                    <input
                      type="email"
                      placeholder="Mail"
                      autoComplete="email"
                      value={authForm.email}
                      onChange={(e) => handleAuthInput('email', e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="Contraseña (mínimo 8 caracteres)"
                      autoComplete="new-password"
                      value={authForm.password}
                      onChange={(e) => handleAuthInput('password', e.target.value)}
                    />
                    <button type="submit" disabled={authLoading}>Registrarme</button>
                  </form>
                )}

                {authMode === 'verify' && (
                  <form className="auth-form" onSubmit={handleVerify}>
                    <input
                      type="email"
                      placeholder="Mail"
                      autoComplete="email"
                      value={authForm.email}
                      onChange={(e) => handleAuthInput('email', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Código de 6 dígitos"
                      autoComplete="one-time-code"
                      value={authForm.verifyCode}
                      onChange={(e) => handleAuthInput('verifyCode', e.target.value)}
                      maxLength={6}
                    />
                    <button type="submit" disabled={authLoading}>Confirmar código</button>
                  </form>
                )}

                {authMode === 'login' && (
                  <form className="auth-form" onSubmit={handleLogin}>
                    <input
                      type="email"
                      placeholder="Mail"
                      autoComplete="username"
                      value={authForm.email}
                      onChange={(e) => handleAuthInput('email', e.target.value)}
                    />

                    <div className="auth-password-row">
                      <span className="auth-field-label">Contraseña</span>
                      <button
                        type="button"
                        className="auth-link"
                        onClick={() => setAuthNotice('Recuperación de contraseña: próximamente')}
                      >
                        ¿Olvidaste contraseña?
                      </button>
                    </div>

                    <input
                      type="password"
                      placeholder="Contraseña"
                      autoComplete="current-password"
                      value={authForm.password}
                      onChange={(e) => handleAuthInput('password', e.target.value)}
                    />
                    <button type="submit" disabled={authLoading}>Entrar</button>
                  </form>
                )}

                <div className="auth-separator" aria-hidden="true">
                  <span>ó</span>
                </div>

                <button
                  type="button"
                  className="google-auth-button"
                  onClick={() => setAuthNotice('Ingreso con Google: próximamente')}
                >
                  <FaGoogle />
                  <span>
                    {authMode === 'login'
                      ? 'Iniciá sesión con Google'
                      : 'Registrarte con Google'}
                  </span>
                </button>
              </section>
            </main>
          ) : (
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
          )}

          {isAuthenticated && showProfilePanel && (
            <aside className="profile-panel">
              <h3>Perfil</h3>
              <p><strong>Mail:</strong> {user.email}</p>

              {profileNotice && <p className="profile-notice">{profileNotice}</p>}

              <form className="profile-form" onSubmit={handleProfileSave}>
                <label>
                  Nombre
                  <input
                    type="text"
                    autoComplete="name"
                    value={authForm.name}
                    onChange={(e) => handleAuthInput('name', e.target.value)}
                    placeholder="(vacío por defecto)"
                  />
                </label>
                <label>
                  Año de nacimiento
                  <input
                    type="number"
                    value={authForm.birthYear}
                    onChange={(e) => handleAuthInput('birthYear', e.target.value)}
                    placeholder="(vacío por defecto)"
                  />
                </label>
                <button type="submit" disabled={profileLoading}>Guardar perfil</button>
              </form>

              <form className="profile-form" onSubmit={handlePasswordChange}>
                <label>
                  Contraseña actual
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={authForm.currentPassword}
                    onChange={(e) => handleAuthInput('currentPassword', e.target.value)}
                  />
                </label>
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={authForm.newPassword}
                    onChange={(e) => handleAuthInput('newPassword', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </label>
                <button type="submit" disabled={profileLoading}>Cambiar contraseña</button>
              </form>
            </aside>
          )}
        </div>
      </div>

      <div className="floating-card" aria-label="Marcos Constantino links">
        <a
          href="https://github.com/MarcosConstantino2003"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="floating-card-collapsed-icon"
        >
          <FiGithub />
        </a>

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
