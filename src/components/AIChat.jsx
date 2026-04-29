import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Maximize2, MessageCircle, Mic, MicOff, Paperclip, RotateCcw, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ensureStudentList, onStudentDataChange } from '../services/studentDataService';
import { getAIModelSettings, getAITokenStats, getWaitSeconds, resetConversation, sendMessageToGemini } from '../services/geminiService';
import { parseCSVContent, parseXLSXContent } from '../utils/fileParsers';
import {
    buildAIChatPrompt,
    ChatMessage,
    ExpandedChartModal,
    generateChartFromFile,
    getAllStudents,
    MAIN_AI_QUICK_ACTIONS,
    parseAIResponse,
    parseUploadedStudents,
    setUploadedStudentRows,
    tryLocalResponse,
} from '../pages/AIChatPage';

const INITIAL_MESSAGE = {
    role: 'bot',
    text: 'สวัสดีครับ ผม **MJU AI Assistant** (Powered by Gemini)\n\nพร้อมช่วยตอบ **ทุกเรื่องเกี่ยวกับมหาวิทยาลัยแม่โจ้** ถามมาได้เลยครับ\n\n**ฟีเจอร์เหมือนหน้า AI หลัก:**\n- ถาม-ตอบเรื่องแม่โจ้และข้อมูลในเว็บแบบ realtime\n- สร้างกราฟและพยากรณ์จากข้อมูลจริงในระบบ\n- ค้นหานักศึกษาตามรหัส ชื่อ สาขา GPA\n- อัปโหลด CSV/Excel เพื่อวิเคราะห์และสร้างกราฟ\n- สั่งงานด้วยเสียง และขยาย/Export กราฟได้',
    chart: null,
};

function isQuotaError(error) {
    return /รอ|quota|API ถูกใช้งาน|QUOTA/i.test(error?.message || '');
}

export default function AIChat() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const messagesEnd = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [expandedChart, setExpandedChart] = useState(null);
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [uploadedFileData, setUploadedFileData] = useState(null);
    const [, setStudentDataVersion] = useState(0);

    useEffect(() => {
        ensureStudentList();
        return onStudentDataChange(() => setStudentDataVersion(v => v + 1));
    }, []);

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'th-TH';
        recognitionRef.current.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => `${prev} ${transcript}`.trim());
            setIsListening(false);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
    }, []);

    useEffect(() => {
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    const sendAI = useCallback(async (prompt) => {
        const text = await sendMessageToGemini(prompt, {
            user,
            theme,
            aiSettings: getAIModelSettings(),
        });
        getAITokenStats();
        return text;
    }, [user, theme]);

    const handleNewChat = useCallback(() => {
        resetConversation();
        setUploadedFileData(null);
        setUploadedStudentRows([]);
        setMessages([{
            role: 'bot',
            text: '**เริ่มบทสนทนาใหม่แล้ว**\n\nถามมาได้เลยครับ พร้อมช่วยเหมือนหน้า AI หลัก',
            chart: null,
        }]);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        resetConversation();
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: 'เบราว์เซอร์นี้ยังไม่รองรับการสั่งงานด้วยเสียง',
                chart: null,
            }]);
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch {
                setIsListening(false);
            }
        }
    };

    const retryWithCountdown = async (buildPrompt, retryId) => {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            const waitSec = Math.max(getWaitSeconds(), 5) + 2;
            await new Promise(resolve => {
                let remaining = waitSec;
                const update = () => {
                    setMessages(prev => prev.map(message =>
                        message._retryId === retryId
                            ? {
                                ...message,
                                text: `**API ถูกใช้งานบ่อยเกินไป** - รอ ${remaining} วินาที แล้วจะลองใหม่อัตโนมัติ (ครั้งที่ ${attempt}/${maxRetries})`,
                            }
                            : message
                    ));
                };
                update();
                const id = setInterval(() => {
                    remaining -= 1;
                    if (remaining <= 0) {
                        clearInterval(id);
                        resolve();
                    } else {
                        update();
                    }
                }, 1000);
            });

            try {
                const aiText = await sendAI(buildPrompt());
                const parsedAI = parseAIResponse(aiText);
                setMessages(prev => prev.map(message =>
                    message._retryId === retryId
                        ? { role: 'bot', text: `_ลองใหม่สำเร็จ_\n\n${parsedAI.text}`, chart: parsedAI.chart }
                        : message
                ));
                return;
            } catch (error) {
                if (!isQuotaError(error) || attempt === maxRetries) {
                    setMessages(prev => prev.map(message =>
                        message._retryId === retryId
                            ? {
                                role: 'bot',
                                text: isQuotaError(error)
                                    ? '**ยังเชื่อมต่อ AI ไม่สำเร็จหลังลองใหม่หลายครั้ง**\n\nกรุณารอ 3-5 นาทีแล้วลองอีกครั้ง ระหว่างนี้ฟีเจอร์พยากรณ์/ค้นหานักศึกษายังใช้ได้โดยไม่ต้องเรียก AI'
                                    : `${error.message || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\nลองถามใหม่อีกครั้ง`,
                                chart: null,
                            }
                            : message
                    ));
                    return;
                }
            }
        }
    };

    const runQuestion = async (question) => {
        const localResult = tryLocalResponse(question);
        if (localResult) {
            setMessages(prev => [...prev, { role: 'bot', text: localResult.text, chart: localResult.chart }]);
            return;
        }

        const prompt = buildAIChatPrompt(question, uploadedFileData);
        const aiText = await sendAI(prompt);
        const parsedAI = parseAIResponse(aiText);
        setMessages(prev => [...prev, { role: 'bot', text: parsedAI.text, chart: parsedAI.chart }]);
    };

    const submitQuestion = async (question) => {
        if (!question.trim() || typing) return;
        const userMsg = question.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setTyping(true);
        try {
            await runQuestion(userMsg);
        } catch (error) {
            if (isQuotaError(error)) {
                const retryId = `retry_${Date.now()}`;
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: '**API ถูกใช้งานบ่อยเกินไป** - กำลังเตรียมลองใหม่...',
                    chart: null,
                    _retryId: retryId,
                }]);
                await retryWithCountdown(() => buildAIChatPrompt(userMsg, uploadedFileData), retryId);
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `${error.message || 'ไม่สามารถเชื่อมต่อ AI ได้'}\n\nลองถามใหม่อีกครั้ง`,
                    chart: null,
                }]);
            }
        } finally {
            setTyping(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || typing) return;
        event.target.value = '';
        const fileName = file.name;
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (!['csv', 'txt', 'tsv', 'xlsx', 'xls'].includes(ext)) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `**รองรับเฉพาะไฟล์ CSV, TSV, TXT, XLSX, XLS**\n\nไฟล์ "${fileName}" ไม่รองรับ`,
                chart: null,
            }]);
            return;
        }

        setMessages(prev => [...prev, { role: 'user', text: `อัปโหลดไฟล์: **${fileName}**` }]);
        setTyping(true);
        try {
            const parsed = (ext === 'xlsx' || ext === 'xls')
                ? parseXLSXContent(await file.arrayBuffer())
                : parseCSVContent(await file.text());

            if (!parsed || parsed.rows.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `อ่านข้อมูลจากไฟล์ "${fileName}" ไม่ได้\n\nตรวจสอบว่าไฟล์มีหัวคอลัมน์และข้อมูลอย่างน้อย 1 แถว`,
                    chart: null,
                }]);
                return;
            }

            setUploadedFileData(parsed);
            const uploadedStudents = parseUploadedStudents(parsed);
            if (uploadedStudents.length > 0) setUploadedStudentRows(uploadedStudents);
            const chart = generateChartFromFile(parsed, fileName);

            let summary = `**วิเคราะห์ไฟล์: ${fileName}**\n\n`;
            summary += `**ข้อมูล:** ${parsed.rowCount} แถว x ${parsed.headers.length} คอลัมน์\n`;
            summary += `**คอลัมน์:** ${parsed.headers.join(', ')}\n`;
            summary += `**คอลัมน์ตัวเลข:** ${parsed.numericCols.join(', ') || 'ไม่พบ'}\n\n`;
            if (uploadedStudents.length > 0) {
                summary += `**ตรวจพบข้อมูลนักศึกษา ${uploadedStudents.length} คน** - รวมกับข้อมูลระบบแล้ว\n`;
                summary += `**รวมทั้งหมดตอนนี้:** ${getAllStudents().length} คน\n\n`;
                summary += 'ลองถามต่อได้ เช่น "สร้างกราฟจำนวนนักศึกษาแต่ละสาขา" หรือ "นักศึกษาที่ GPA สูงสุด 10 คน"';
            } else {
                summary += '**ตัวอย่างข้อมูล (5 แถวแรก):**\n';
                parsed.rows.slice(0, 5).forEach((row, idx) => {
                    summary += `${idx + 1}. ${parsed.headers.map(header => `${header}: ${row[header]}`).join(' | ')}\n`;
                });
                if (parsed.numericCols.length > 0) {
                    summary += '\n**สร้างกราฟจากไฟล์ให้แล้ว** และสามารถถามต่อให้รวมกับข้อมูล Dashboard ได้';
                }
            }

            setMessages(prev => [...prev, { role: 'bot', text: summary, chart }]);

            const dataPreview = parsed.rows.slice(0, 15).map(row => Object.values(row).join(', ')).join('\n');
            try {
                const aiText = await sendAI(`ผู้ใช้อัปโหลดไฟล์ "${fileName}" มีข้อมูล ${parsed.rowCount} แถว คอลัมน์: ${parsed.headers.join(', ')}\n\nตัวอย่างข้อมูล:\n${dataPreview}\n\nช่วยวิเคราะห์และสรุปข้อมูลนี้แบบกระชับ`);
                const parsedAI = parseAIResponse(aiText);
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: `**AI วิเคราะห์เพิ่มเติม:**\n\n${parsedAI.text}`,
                    chart: parsedAI.chart,
                }]);
            } catch (error) {
                console.warn('[AIChat popup] AI file analysis skipped:', error?.message || error);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `อ่านไฟล์ล้มเหลว: ${error.message || 'ไม่ทราบสาเหตุ'}`,
                chart: null,
            }]);
        } finally {
            setTyping(false);
        }
    };

    const [fabPos, setFabPos] = useState({ right: 24, bottom: 24 });
    const dragRef = useRef({ dragging: false, hasMoved: false, startX: 0, startY: 0, startR: 0, startB: 0 });

    const onDragStart = useCallback((clientX, clientY) => {
        dragRef.current = {
            dragging: true,
            hasMoved: false,
            startX: clientX,
            startY: clientY,
            startR: fabPos.right,
            startB: fabPos.bottom,
        };
    }, [fabPos]);

    const onDragMove = useCallback((clientX, clientY) => {
        const drag = dragRef.current;
        if (!drag.dragging) return;
        const dx = clientX - drag.startX;
        const dy = clientY - drag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.hasMoved = true;
        if (!drag.hasMoved) return;
        setFabPos({
            right: Math.max(0, Math.min(window.innerWidth - 60, drag.startR - dx)),
            bottom: Math.max(0, Math.min(window.innerHeight - 60, drag.startB - dy)),
        });
    }, []);

    const onDragEnd = useCallback(() => { dragRef.current.dragging = false; }, []);
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        onDragStart(e.clientX, e.clientY);
        const moveHandler = (event) => onDragMove(event.clientX, event.clientY);
        const upHandler = () => {
            onDragEnd();
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    }, [onDragStart, onDragMove, onDragEnd]);

    const handleTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        onDragStart(touch.clientX, touch.clientY);
    }, [onDragStart]);
    const handleTouchMove = useCallback((e) => {
        const touch = e.touches[0];
        onDragMove(touch.clientX, touch.clientY);
    }, [onDragMove]);
    const handleFabClick = useCallback(() => {
        if (!dragRef.current.hasMoved) setIsOpen(prev => !prev);
    }, []);

    return (
        <>
            <button
                className="ai-chat-trigger"
                onClick={handleFabClick}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={onDragEnd}
                style={{ right: fabPos.right, bottom: fabPos.bottom, touchAction: 'none', userSelect: 'none' }}
                aria-label={isOpen ? 'ปิดแชท AI' : 'เปิดแชท AI'}
            >
                {isOpen ? <X size={26} /> : <MessageCircle size={26} />}
                {!isOpen && <span className="pulse" />}
            </button>

            {isOpen && (() => {
                const panelH = 560;
                const fabSize = 60;
                const gap = 10;
                const fabX = window.innerWidth - fabPos.right - fabSize;
                const onRightHalf = (fabX + fabSize / 2) > window.innerWidth / 2;
                const panelStyle = { position: 'fixed', zIndex: 999 };
                if (onRightHalf) panelStyle.right = Math.max(0, fabPos.right);
                else panelStyle.left = Math.max(0, fabX);
                let panelBottom = fabPos.bottom + fabSize + gap;
                if (panelBottom + panelH > window.innerHeight) panelBottom = Math.max(4, window.innerHeight - panelH - 4);
                panelStyle.bottom = panelBottom;

                return (
                    <div className="ai-chat-panel" style={panelStyle}>
                        <div className="ai-chat-header">
                            <div className="ai-chat-header-left">
                                <div className="ai-chat-header-avatar"><Bot size={20} /></div>
                                <div>
                                    <h3>MJU AI Assistant</h3>
                                    <p>Powered by Gemini</p>
                                </div>
                            </div>
                            <div className="ai-chat-popup-header-actions">
                                <button className="ai-chat-close" onClick={handleNewChat} aria-label="เริ่มแชทใหม่" data-tooltip="เริ่มใหม่">
                                    <RotateCcw size={16} />
                                </button>
                                <button
                                    className="ai-chat-close"
                                    onClick={() => {
                                        setIsOpen(false);
                                        navigate('/dashboard/ai-chat');
                                    }}
                                    aria-label="เปิดหน้า AI หลัก"
                                    data-tooltip="เปิดหน้า AI หลัก"
                                >
                                    <Maximize2 size={16} />
                                </button>
                                <button className="ai-chat-close" onClick={handleClose} aria-label="ปิด">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="ai-chat-messages ai-chat-popup-messages">
                            {messages.map((msg, index) => (
                                <ChatMessage key={`${msg.role}-${index}`} msg={msg} onExpand={setExpandedChart} />
                            ))}
                            {typing && (
                                <div className="typing-indicator">
                                    <span /><span /><span />
                                </div>
                            )}
                            <div ref={messagesEnd} />
                        </div>

                        {messages.length <= 2 && (
                            <div className="chat-quick-actions">
                                {MAIN_AI_QUICK_ACTIONS.slice(0, 4).map((action) => {
                                    const Icon = action.icon;
                                    return (
                                        <button key={action.label} className="chat-quick-btn" onClick={() => submitQuestion(action.query)}>
                                            <Icon size={12} /> {action.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="ai-chat-input-area">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.tsv,.txt,.xlsx,.xls"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                            <button
                                className="ai-chat-mic"
                                type="button"
                                onClick={toggleListening}
                                disabled={typing}
                                aria-label="สั่งงานด้วยเสียง"
                                data-tooltip="สั่งงานด้วยเสียง"
                            >
                                {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button
                                className="ai-chat-mic"
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={typing}
                                aria-label="อัปโหลดไฟล์ CSV/Excel"
                                data-tooltip="อัปโหลดไฟล์"
                            >
                                <Paperclip size={19} />
                            </button>
                            <input
                                type="text"
                                placeholder={isListening ? 'กำลังฟัง...' : 'ถามหรือแนบ CSV/Excel เพื่อวิเคราะห์...'}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitQuestion(input); }}
                                disabled={typing}
                            />
                            <button className="ai-chat-send" onClick={() => submitQuestion(input)} disabled={typing || !input.trim()} aria-label="ส่งคำถาม">
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                );
            })()}

            {expandedChart && (
                <ExpandedChartModal
                    chart={expandedChart}
                    onClose={() => setExpandedChart(null)}
                />
            )}
        </>
    );
}
