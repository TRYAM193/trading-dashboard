'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  Bot, 
  Terminal, 
  PlusCircle, 
  ArrowRight,
  TrendingUp,
  Briefcase,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  X
} from 'lucide-react';
import styles from './page.module.css';

export default function CopilotChat() {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: 'Hello! I am your Personal Assistant and Portfolio Copilot. 🧑‍💼 I am here to help you manage your trading terminal, audit your portfolios, check quotes, or execute orders. What can I do for you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolLogs, setToolLogs] = useState([]);
  
  // Speech & Connection Settings State
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempUrl, setTempUrl] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load settings & Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = window.localStorage.getItem('trading_copilot_server_url') || '';
      setServerUrl(savedUrl);
      setTempUrl(savedUrl);

      // Initialize Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = (e) => {
          console.error('Speech recognition error:', e);
          setIsListening(false);
        };
        rec.onresult = (event) => {
          const text = event.results[0][0].transcript;
          setInput(text);
        };
        recognitionRef.current = rec;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speak response text
  const speakText = (text) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Cancel active speech

    // Clean text: strip out emojis and markdown symbols for cleaner text speech
    const cleanText = text
      .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "")
      .replace(/[*#`_\-]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  };

  // Toggle mic listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported on this browser/device. Try using Chrome or a mobile webview.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Toggle speaker mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleSend = async (textToSend) => {
    const messageText = textToSend || input;
    if (!messageText.trim()) return;

    if (!textToSend) {
      setInput('');
    }
    
    // Add user message to chat UI
    const newMessages = [...messages, { role: 'user', content: messageText }];
    setMessages(newMessages);
    setLoading(true);
    setToolLogs([]);

    try {
      // Map frontend history to API history format
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: historyPayload
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
        if (data.toolLogs && data.toolLogs.length > 0) {
          setToolLogs(data.toolLogs);
        }
        // Speak response aloud if unmuted
        speakText(data.reply);
      } else {
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: `⚠️ Error: ${data.error || 'Failed to get a response from the secretary.'}` 
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: '⚠️ Connection error. Please make sure the backend server is running and your server URL settings are correct.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const triggerSuggestion = (text) => {
    handleSend(text);
  };

  const saveSettings = (e) => {
    e.preventDefault();
    const cleanUrl = tempUrl.trim().replace(/\/$/, '');
    window.localStorage.setItem('trading_copilot_server_url', cleanUrl);
    setServerUrl(cleanUrl);
    setShowSettings(false);
  };

  const suggestions = [
    { label: 'Show active positions', text: 'Show active positions' },
    { label: 'Why did you buy TTWO?', text: 'Why did you buy TTWO?' },
    { label: 'Check price of MSFT', text: 'What is the current stock quote for MSFT?' },
    { label: 'Buy 5 shares of AAPL', text: 'Buy 5 shares of AAPL' },
    { label: 'Sell all AAPL', text: 'Sell all shares of AAPL' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Sparkles className={styles.sparkleIcon} />
          <h1>AI Secretary Console</h1>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={`${styles.iconBtn} ${showSettings ? styles.iconBtnActive : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Server Connection Settings"
          >
            <Settings size={18} />
          </button>
          <button 
            className={`${styles.iconBtn} ${!isMuted ? styles.speakerActive : ''}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute Secretary voice" : "Mute Secretary voice"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className={styles.statusBadge}>
            <span className={styles.pulseDot}></span>
            {serverUrl ? 'Connected' : 'Local Node'}
          </div>
        </div>
      </header>

      {/* Settings Overlay Drawer */}
      {showSettings && (
        <div className={styles.settingsOverlay}>
          <div className={styles.settingsCard}>
            <div className={styles.settingsCardHeader}>
              <h3>Server Connection Settings</h3>
              <button className={styles.closeBtn} onClick={() => setShowSettings(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={saveSettings} className={styles.settingsForm}>
              <p className={styles.settingsHelp}>
                Enter the absolute hosted base URL of your Trading Copilot dashboard (e.g. <code>https://your-app.vercel.app</code> or local IP <code>http://192.168.1.50:3000</code>). Leave blank to use local relative requests.
              </p>
              <div className={styles.settingsInputGroup}>
                <label>Server Base URL</label>
                <input 
                  type="url" 
                  value={tempUrl} 
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="e.g. http://192.168.1.100:3000"
                  className={styles.settingsInput}
                />
              </div>
              <div className={styles.settingsFormActions}>
                <button type="button" onClick={() => { setTempUrl(''); window.localStorage.setItem('trading_copilot_server_url', ''); setServerUrl(''); setShowSettings(false); }} className={styles.settingsReset}>
                  Reset
                </button>
                <button type="submit" className={styles.settingsSave}>
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={styles.workspace}>
        {/* Chat Area */}
        <div className={styles.chatContainer}>
          <div className={styles.messageList}>
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={index} 
                  className={`${styles.messageWrapper} ${isUser ? styles.userWrapper : styles.botWrapper}`}
                >
                  <div className={styles.avatar}>
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={styles.bubble}>
                    <div className={styles.bubbleContent}>
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {loading && (
              <div className={`${styles.messageWrapper} ${styles.botWrapper}`}>
                <div className={styles.avatar}>
                  <Bot size={16} />
                </div>
                <div className={styles.bubble}>
                  <div className={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className={styles.loadingText}>Secretary is executing commands...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div className={styles.suggestions}>
            {suggestions.map((s, idx) => (
              <button 
                key={idx} 
                className={styles.suggestionBtn}
                onClick={() => triggerSuggestion(s.text)}
                disabled={loading}
              >
                <PlusCircle size={12} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form className={styles.inputForm} onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Ask a question or request a trade (e.g. 'Buy 5 shares of MSFT')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className={styles.textInput}
            />
            <button 
              type="button" 
              onClick={toggleListening} 
              disabled={loading}
              className={`${styles.micBtn} ${isListening ? styles.micActive : ''}`}
              title={isListening ? "Stop listening" : "Start speaking"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button type="submit" disabled={loading || !input.trim()} className={styles.sendBtn}>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Sidebar Tool Logs */}
        <div className={styles.toolConsole}>
          <div className={styles.consoleHeader}>
            <Terminal size={14} />
            <span>Execution Console Logs</span>
          </div>
          <div className={styles.consoleBody}>
            {toolLogs.length === 0 ? (
              <div className={styles.emptyConsole}>
                <p>No system tools executed recently.</p>
                <p className={styles.consoleSub}>When you ask the AI to trade or pull data, the executed terminal commands will stream here.</p>
              </div>
            ) : (
              <div className={styles.logList}>
                {toolLogs.map((log, idx) => (
                  <div key={idx} className={styles.logItem}>
                    <div className={styles.logTime}>
                      {new Date().toLocaleTimeString()}
                    </div>
                    <div className={styles.logEvent}>
                      <span className={styles.logTool}>[TOOL CALL]</span> {log.name}
                    </div>
                    <pre className={styles.logArgs}>
                      {JSON.stringify(log.args, null, 2)}
                    </pre>
                  </div>
                ))}
                <div className={styles.logItemSuccess}>
                  <span className={styles.successBadge}>[SUCCESS]</span> ReAct loop execution finished successfully.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
