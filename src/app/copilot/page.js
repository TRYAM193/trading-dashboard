'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  Bot, 
  Terminal, 
  PlusCircle, 
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
  const [aiEngine, setAiEngine] = useState('gemini');
  const [tempEngine, setTempEngine] = useState('gemini');

  // Voice Mode & Animation States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState('chat'); // 'chat' or 'voice'
  const [continuousMode, setContinuousMode] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [expandedMessages, setExpandedMessages] = useState({});
  const [loadingTaskText, setLoadingTaskText] = useState('Assistant is analyzing request...');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const modeRef = useRef(mode);
  const continuousModeRef = useRef(continuousMode);
  const isMutedRef = useRef(isMuted);
  const conversationHistoryRef = useRef([]);
  const isLoadingRef = useRef(loading);

  // Web Audio VAD Refs & State
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastSpeechTimeRef = useRef(0);
  const speechDetectedRef = useRef(false);

  const [orbScale, setOrbScale] = useState(1);
  const [softVoice, setSoftVoice] = useState(null);

  // Sync refs to avoid closure traps in event callbacks
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isLoadingRef.current = loading;
  }, [loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Rotate task text during loading
  useEffect(() => {
    if (!loading) return;
    const tasks = [
      'Analyzing request instructions...',
      'Checking Google Sheets master ledger...',
      'Retrieving active portfolio assets from Alpaca...',
      'Consulting web search for news catalysts...',
      'Evaluating portfolio risk limits...',
      'Updating Sheets trade logging rows...',
      'Synthesizing final ReAct decisions...'
    ];
    let idx = 0;
    setLoadingTaskText(tasks[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % tasks.length;
      setLoadingTaskText(tasks[idx]);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const toggleMessageSteps = (idx) => {
    setExpandedMessages(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // VAD Audio Controls
  const stopVAD = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.error(e);
      }
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) {
        console.error(e);
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setOrbScale(1);
  };

  const startVAD = async () => {
    try {
      stopVAD(); // Clean up existing context before starting

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // Fast analysis
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      lastSpeechTimeRef.current = Date.now();
      speechDetectedRef.current = false;

      let speechFrameCount = 0;
      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Normalize RMS volume (0-255) to a scale factor for the orb (1.0 to 1.25)
        const normalizedVol = Math.min(rms / 40, 1);
        const targetScale = 1 + normalizedVol * 0.25;

        // Smooth output to avoid visual jittering
        setOrbScale(prev => prev + (targetScale - prev) * 0.2);

        const now = Date.now();
        // VAD threshold (RMS > 6 represents audible speech)
        if (rms > 6) {
          speechFrameCount++;
          // Require at least 8 consecutive frames (~130ms) to confirm voice activity (prevents clicks/ambient noise triggers)
          if (speechFrameCount >= 8) {
            lastSpeechTimeRef.current = now;
            if (!speechDetectedRef.current) {
              speechDetectedRef.current = true;
              console.log("VAD: Voice activity confirmed.");
            }
          }
        } else {
          speechFrameCount = Math.max(0, speechFrameCount - 1);
          
          // If user was speaking and is now silent for > 2000ms, auto-stop mic
          if (speechDetectedRef.current && (now - lastSpeechTimeRef.current > 2000)) {
            console.log("VAD: Sustained silence detected. Auto-finalizing speech recognition.");
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch (e) {
                console.error(e);
              }
            }
            stopVAD();
            return;
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      animationFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn("VAD / Web Audio API initialization failed:", err);
    }
  };

  // Load and select soft voice
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const findSoftVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // Prioritized keywords for warmer/softer natural female/assistant voices
      const candidates = ['aria', 'zira', 'samantha', 'hazel', 'google us', 'google uk', 'natural', 'female'];
      let selected = null;

      for (const keyword of candidates) {
        selected = voices.find(v => 
          v.lang.startsWith('en') && 
          v.name.toLowerCase().includes(keyword)
        );
        if (selected) break;
      }

      if (!selected) {
        selected = voices.find(v => v.lang.startsWith('en')) || voices[0];
      }

      console.log('Selected Assistant Voice:', selected?.name);
      setSoftVoice(selected);
    };

    findSoftVoice();
    window.speechSynthesis.onvoiceschanged = findSoftVoice;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Load settings & Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = window.localStorage.getItem('trading_copilot_server_url') || '';
      const savedEngine = window.localStorage.getItem('trading_copilot_ai_engine') || 'gemini';
      setServerUrl(savedUrl);
      setTempUrl(savedUrl);
      setAiEngine(savedEngine);
      setTempEngine(savedEngine);

      // Initialize Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
          startVAD();
        };
        rec.onend = () => {
          setIsListening(false);
          stopVAD();
        };
        rec.onerror = (e) => {
          console.error('Speech recognition error:', e);
          setIsListening(false);
          stopVAD();
        };
        rec.onresult = (event) => {
          const text = event.results[0][0].transcript;
          setInput(text);
          if (modeRef.current === 'voice') {
            setVoiceTranscript(`You: "${text}"`);
            handleSend(text);
          }
        };
        recognitionRef.current = rec;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopVAD();
    };
  }, []);

  // Speak response text
  const speakText = (text) => {
    const activeMute = modeRef.current === 'voice' ? false : isMutedRef.current;
    if (activeMute || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Cancel active speech

    // Clean text: strip out emojis and markdown symbols for cleaner text speech
    const cleanText = text
      .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "")
      .replace(/[*#`_\-]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (softVoice) {
      utterance.voice = softVoice;
    }
    
    // Softer, calmer speech tuning parameters
    utterance.pitch = 1.02; // Warm, friendly pitch
    utterance.rate = 0.92;  // Gentle, slower delivery rate
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setVoiceTranscript(cleanText);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      // If continuous mode is enabled and still in voice mode, trigger mic listening (only if not loading/thinking)
      if (continuousModeRef.current && modeRef.current === 'voice' && recognitionRef.current && !isLoadingRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Failed to auto-restart listen:', e);
          }
        }, 800);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

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
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel(); // Stop talking when user speaks
      }
      setIsSpeaking(false);
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

    if (modeRef.current === 'voice') {
      setVoiceTranscript(`Thinking...`);
    }

    try {
      // Map complete ReAct context history, fall back to simple messages array if empty
      const historyPayload = conversationHistoryRef.current.length > 0
        ? conversationHistoryRef.current
        : messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          }));

      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: historyPayload,
          aiEngine: aiEngine
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'model', content: data.reply, steps: data.executionSteps }]);
        if (data.toolLogs && data.toolLogs.length > 0) {
          setToolLogs(data.toolLogs);
        }
        // Save stateful ReAct execution history context
        if (data.history) {
          conversationHistoryRef.current = data.history;
        }
        // Speak response aloud
        speakText(data.reply);
      } else {
        const errorMsg = `⚠️ Error: ${data.error || 'Failed to get a response.'}`;
        setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
        if (modeRef.current === 'voice') {
          setVoiceTranscript(errorMsg);
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      const connErrorMsg = '⚠️ Connection error. Please verify Vercel deployment URL settings.';
      setMessages(prev => [...prev, { role: 'model', content: connErrorMsg }]);
      if (modeRef.current === 'voice') {
        setVoiceTranscript(connErrorMsg);
      }
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
    window.localStorage.setItem('trading_copilot_ai_engine', tempEngine);
    setServerUrl(cleanUrl);
    setAiEngine(tempEngine);
    setShowSettings(false);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'voice') {
      setIsMuted(false); // Auto-unmute voice
      setVoiceTranscript('Welcome! Tap the glowing orb and start speaking to your Personal Assistant.');
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
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

        {/* Tab switcher */}
        <div className={styles.modeTabs}>
          <button 
            className={`${styles.tabBtn} ${mode === 'chat' ? styles.tabActive : ''}`}
            onClick={() => handleModeChange('chat')}
          >
            💬 Chat Mode
          </button>
          <button 
            className={`${styles.tabBtn} ${mode === 'voice' ? styles.tabActive : ''}`}
            onClick={() => handleModeChange('voice')}
          >
            🗣️ Voice Mode
          </button>
        </div>

        <div className={styles.headerActions}>
          <button 
            className={`${styles.iconBtn} ${showSettings ? styles.iconBtnActive : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Server Connection Settings"
          >
            <Settings size={18} />
          </button>
          {mode === 'chat' && (
            <button 
              className={`${styles.iconBtn} ${!isMuted ? styles.speakerActive : ''}`}
              onClick={toggleMute}
              title={isMuted ? "Unmute Secretary voice" : "Mute Secretary voice"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
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
                Configure server URL and default AI assistant intelligence engine.
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
              <div className={styles.settingsInputGroup} style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Assistant Engine</label>
                <select
                  value={tempEngine}
                  onChange={(e) => setTempEngine(e.target.value)}
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    width: '100%',
                    height: '40px',
                    padding: '8px 12px',
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="gemini">Google Gemini 2.5 Flash (Recommended)</option>
                  <option value="groq">Groq Llama 3.3 70B</option>
                </select>
              </div>
              <div className={styles.settingsFormActions}>
                <button type="button" onClick={() => { setTempUrl(''); setTempEngine('gemini'); window.localStorage.setItem('trading_copilot_server_url', ''); window.localStorage.setItem('trading_copilot_ai_engine', 'gemini'); setServerUrl(''); setAiEngine('gemini'); setShowSettings(false); }} className={styles.settingsReset}>
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

      {/* Workspaces */}
      <div className={styles.workspace}>
        {mode === 'chat' ? (
          <>
            {/* Chat Area */}
            <div className={styles.chatContainer}>
              <div className={styles.messageList}>
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const hasSteps = !isUser && msg.steps && msg.steps.length > 0;
                  const isExpanded = !!expandedMessages[index];

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

                        {/* Agentic UI: Expandable Step-by-Step execution trail */}
                        {hasSteps && (
                          <div className={styles.agentStepsToggle}>
                            <button 
                              type="button" 
                              onClick={() => toggleMessageSteps(index)}
                              className={styles.stepsToggleBtn}
                            >
                              {isExpanded ? '▼ Hide Agent Action Steps' : '▶ View Agent Action Steps'}
                            </button>
                            
                            {isExpanded && (
                              <div className={styles.agentStepsContainer}>
                                {msg.steps.map((step, sIdx) => {
                                  const isSearch = step.toolCall?.name === 'web_search';
                                  const isSheets = step.toolCall?.name === 'log_custom_trade_record';
                                  const isOrder = step.toolCall?.name?.startsWith('place_');
                                  const isPortfolio = step.toolCall?.name === 'get_portfolio_status' || step.toolCall?.name === 'get_trade_history';
                                  const isQuote = step.toolCall?.name === 'get_stock_quote';

                                  let badgeText = 'ReAct Decision';
                                  let badgeClass = styles.badgeDecision;
                                  if (isSearch) { badgeText = '🔍 Web Search'; badgeClass = styles.badgeSearch; }
                                  else if (isSheets) { badgeText = '📝 Sheets Ledger'; badgeClass = styles.badgeSheets; }
                                  else if (isOrder) { badgeText = '⚡ Trade Order'; badgeClass = styles.badgeOrder; }
                                  else if (isPortfolio) { badgeText = '📊 Portfolio'; badgeClass = styles.badgePortfolio; }
                                  else if (isQuote) { badgeText = '📈 Price Quote'; badgeClass = styles.badgeQuote; }

                                  return (
                                    <div key={sIdx} className={styles.agentStepItem}>
                                      <div className={styles.stepHeader}>
                                        <span className={styles.stepNum}>Step {step.iteration}:</span>
                                        <span className={`${styles.stepBadge} ${badgeClass}`}>{badgeText}</span>
                                        {step.toolCall && (
                                          <span className={styles.stepToolName}>({step.toolCall.name})</span>
                                        )}
                                      </div>
                                      
                                      {step.thought && (
                                        <div className={styles.stepThought}>
                                          <strong>Reasoning:</strong> {step.thought}
                                        </div>
                                      )}

                                      {step.toolCall && (
                                        <div className={styles.stepDetails}>
                                          <details className={styles.jsonDetails}>
                                            <summary className={styles.jsonSummary}>View Tool Parameters & Outputs</summary>
                                            <pre className={styles.stepCode}>
                                              {JSON.stringify({
                                                arguments: step.toolCall.args,
                                                output: step.toolResult
                                              }, null, 2)}
                                            </pre>
                                          </details>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
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
                      <span className={styles.loadingText}>{loadingTaskText}</span>
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
          </>
        ) : (
          /* Voice Assistant Mode View */
          <div className={styles.voiceWorkspace}>
            <div className={styles.voiceOrbCard}>
              <div 
                className={`${styles.orbContainer} ${
                  isListening ? styles.listening : 
                  loading ? styles.thinking : 
                  isSpeaking ? styles.speaking : ''
                }`}
                onClick={toggleListening}
                title="Tap to speak"
                style={{ transform: `scale(${orbScale})` }}
              >
                <div className={styles.orbOuter}></div>
                <div className={styles.orbInner}>
                  {isListening ? (
                    <Mic size={44} className={styles.orbMicIcon} />
                  ) : (
                    <Bot size={44} className={styles.orbMicIcon} />
                  )}
                </div>
              </div>
              
              <div className={styles.voiceStatusText}>
                {isListening ? (
                  <span className={styles.statusListening}>Listening to you...</span>
                ) : loading ? (
                  <span className={styles.statusThinking}>Thinking...</span>
                ) : isSpeaking ? (
                  <span className={styles.statusSpeaking}>Assistant is speaking</span>
                ) : (
                  <span className={styles.statusTap}>Tap Orb to Speak</span>
                )}
              </div>
            </div>

            {/* Vocal Soundwave Equalizer (Pulsating when speaking) */}
            <div className={`${styles.soundwaveContainer} ${isSpeaking ? styles.active : ''}`}>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
              <div className={styles.soundbar}></div>
            </div>

            {/* Subtitle / Live Transcript Display */}
            <div className={styles.subtitleCard}>
              <p className={styles.subtitleText}>
                {voiceTranscript || 'Welcome! Tap the glowing orb and start speaking to your Personal Assistant.'}
              </p>
            </div>

            {/* Hands-free Toggle */}
            <div className={styles.handsfreeControl}>
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={continuousMode}
                  onChange={(e) => setContinuousMode(e.target.checked)}
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxCustom}></span>
                <span>Auto-Listen (Hands-free Continuous Conversation)</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
