import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Pill,
  Clock,
  Send,
  ShieldAlert,
  Sparkles,
  Heart,
  Footprints,
  Coffee,
  Volume2,
  RotateCcw,
} from 'lucide-react';
import type { ReminderItem, ConversationMessage, AuthSession } from '../types/telemetry';
import {
  fetchReminders,
  toggleReminder,
  fetchCompanionChat,
  sendCompanionMessage,
  clearCompanionChat,
} from '../services/api';

interface AiCompanionViewProps {
  session?: AuthSession | null;
}

export const AiCompanionView: React.FC<AiCompanionViewProps> = ({ session }) => {
  const patientId = session?.patient_id || 1;
  const patientName = session?.patient_name || 'Opa Budi Santoso';

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [rem, chat] = await Promise.all([
        fetchReminders(patientId),
        fetchCompanionChat(patientId),
      ]);
      setReminders(rem);
      setMessages(chat);
    } catch (err) {
      console.error('[AiCompanionView] Gagal load data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleToggleReminder = async (id: number, currentStatus: boolean) => {
    await toggleReminder(id, !currentStatus);
    loadData();
  };

  const handleClearChat = async () => {
    if (confirm('Bersihkan riwayat percakapan dan mulai sesi baru?')) {
      await clearCompanionChat(patientId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      loadData();
    }
  };

  const handleSpeak = (id: number, text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (speakingId === id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendPrompt = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;

    const userText = textToSend.trim();
    setInputText('');
    setIsSending(true);
    setIsTyping(true);

    // Optimistic UI update: tampilkan pesan user langsung di layar
    const tempMsg: ConversationMessage = {
      id: Date.now(),
      patient_id: patientId,
      sender: 'ELDER',
      message: userText,
      sentiment: 'NEUTRAL',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await sendCompanionMessage(patientId, userText);
      await loadData();
    } catch (err) {
      console.error('[Chat Error]:', err);
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(inputText);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none font-sans">
      {/* Kolom Kiri: Pengingat Obat & Aktivitas */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-none p-6 border-2 border-neutral-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-none bg-neutral-900 text-white flex items-center justify-center">
                <Pill className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-[#111111]">Jadwal Obat & Aktivitas</h3>
            </div>
            <span className="text-[11px] bg-neutral-100 text-neutral-800 border border-neutral-400 px-2.5 py-0.5 rounded-none font-bold uppercase">
              Pilar 3
            </span>
          </div>

          <p className="text-xs text-neutral-500 mb-4">
            AI Companion membacakan pengingat suara di jam tangan dan memvalidasi konfirmasi {patientName} secara otomatis.
          </p>

          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="p-4 bg-neutral-50 border border-neutral-200 text-xs text-neutral-500 text-center">
                Belum ada jadwal obat yang tercatat untuk pasien ini.
              </div>
            ) : (
              reminders.map((rem) => (
                <div
                  key={rem.id}
                  className={`p-3.5 rounded-none border-2 transition-all flex items-center justify-between ${
                    rem.is_confirmed
                      ? 'bg-emerald-50/70 border-emerald-500'
                      : 'bg-neutral-50 border-neutral-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-none flex items-center justify-center shrink-0 mt-0.5 ${
                        rem.is_confirmed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-neutral-400 block tracking-wider uppercase">
                        {rem.time_scheduled} WIB • {rem.reminder_type}
                      </span>
                      <h4
                        className={`text-xs font-bold ${
                          rem.is_confirmed ? 'text-emerald-950 line-through' : 'text-neutral-900'
                        }`}
                      >
                        {rem.title}
                      </h4>
                      {rem.confirmed_at && (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          Dikonfirmasi jam {new Date(rem.confirmed_at).toLocaleTimeString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleReminder(rem.id, rem.is_confirmed)}
                    className={`px-3 py-1.5 rounded-none text-xs font-bold transition-colors cursor-pointer border ${
                      rem.is_confirmed
                        ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                        : 'bg-white border-neutral-900 text-neutral-900 hover:bg-neutral-100'
                    }`}
                  >
                    {rem.is_confirmed ? 'Sudah' : 'Konfirmasi'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Batasan Etis AI */}
        <div className="bg-neutral-900 text-white rounded-none p-5 border-2 border-neutral-900 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Panduan Etika & Batasan Medis AI</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Asisten AI tidak memberikan diagnosis medis langsung. Respon difokuskan pada sapaan ramah,
            pendampingan emosi, pengecekan data biometrik real-time, konfirmasi jadwal obat, dan pengalihan ke kontak keluarga/tenaga medis jika ada keluhan serius.
          </p>
        </div>
      </div>

      {/* Kolom Kanan: Antarmuka Percakapan AI Check-in */}
      <div className="lg:col-span-7 bg-white rounded-none p-6 border-2 border-neutral-900 shadow-xs flex flex-col h-[640px]">
        {/* Header Chat */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-neutral-900 mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-none bg-neutral-900 text-white flex items-center justify-center font-black text-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#111111]">Sahabat Peduli</h3>
                <span className="text-[10px] bg-neutral-100 border border-neutral-300 text-neutral-800 px-2 py-0.2 font-bold font-mono">
                  {patientName}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-neutral-700" />
                Pendamping Cerdas Real-time Bahasa Indonesia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearChat}
              title="Bersihkan riwayat obrolan & mulai sesi baru"
              className="p-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px] font-bold">Reset Chat</span>
            </button>

            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-none border border-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Siap
            </span>
          </div>
        </div>

        {/* Quick Suggestion Chips (Tanya Cepat Real-time) */}
        <div className="mb-3 shrink-0 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => handleSendPrompt('Bagaimana detak jantung saya sekarang nak?')}
            disabled={isSending}
            className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-rose-600" />
            <span>Detak Jantung Saya</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Apakah ada jadwal obat yang harus saya minum sekarang?')}
            disabled={isSending}
            className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Pill className="w-3.5 h-3.5 text-blue-600" />
            <span>Jadwal Obat Berikutnya</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Sudah berapa langkah saya jalan hari ini?')}
            disabled={isSending}
            className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Footprints className="w-3.5 h-3.5 text-emerald-600" />
            <span>Langkah Hari Ini</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Halo nak, mau ngobrol santai sebentar')}
            disabled={isSending}
            className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-600" />
            <span>Ngobrol Santai</span>
          </button>
        </div>

        {/* Chat History Box */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 border border-neutral-200 bg-[#FAFAFA] p-3.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <Bot className="w-8 h-8 mb-2 text-neutral-300" />
              <p className="text-xs font-bold text-neutral-600">Belum ada percakapan.</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Pilih tombol saran di atas atau ketik sapaan untuk mulai mengobrol bersama Sahabat Peduli.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isAI = m.sender === 'AI';
              const isSpeaking = speakingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-none text-xs sm:text-sm leading-relaxed ${
                      isAI
                        ? 'bg-white border-2 border-neutral-900 text-neutral-900 shadow-xs'
                        : 'bg-neutral-900 text-white border-2 border-neutral-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.message}</p>

                    {/* Tombol Suara TTS untuk Balasan AI */}
                    {isAI && (
                      <div className="mt-2.5 pt-2 border-t border-neutral-200 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleSpeak(m.id, m.message)}
                          className={`text-[11px] font-bold flex items-center gap-1.5 px-2 py-0.5 border cursor-pointer transition-colors ${
                            isSpeaking
                              ? 'bg-rose-100 border-rose-400 text-rose-700 animate-pulse'
                              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
                          }`}
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{isSpeaking ? 'Hentikan Suara' : 'Dengarkan Suara'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-neutral-400 font-medium">
                    <span>
                      {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {m.sentiment && m.sentiment !== 'NEUTRAL' && (
                      <span className="uppercase text-[9px] font-bold text-neutral-600">
                        • {m.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex flex-col items-start animate-fadeIn">
              <div className="bg-white border-2 border-neutral-900 p-3 rounded-none text-xs text-neutral-700 flex items-center gap-2 shadow-xs">
                <span className="font-bold text-neutral-900">Sahabat Peduli sedang merespons</span>
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleFormSubmit} className="pt-3 border-t border-neutral-200 mt-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ketik keluhan atau sapaan dari ${patientName} (misal: 'Jantung berdebar kencang nak', 'Mual')...`}
              disabled={isSending}
              className="flex-1 bg-white border-2 border-neutral-300 focus:border-neutral-900 rounded-none px-4 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-none text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer border-2 border-neutral-900"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Mengirim...' : 'Kirim'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
