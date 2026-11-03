import React, { useState, useEffect } from 'react';
import {
  Bot,
  Pill,
  Clock,
  Send,
  ShieldAlert,
} from 'lucide-react';
import type { ReminderItem, ConversationMessage } from '../types/telemetry';
import {
  fetchReminders,
  toggleReminder,
  fetchCompanionChat,
  sendCompanionMessage,
} from '../services/api';

export const AiCompanionView: React.FC = () => {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadData = async () => {
    const [rem, chat] = await Promise.all([
      fetchReminders(1),
      fetchCompanionChat(1),
    ]);
    setReminders(rem);
    setMessages(chat);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleReminder = async (id: number, currentStatus: boolean) => {
    await toggleReminder(id, !currentStatus);
    loadData();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const msg = inputText;
    setInputText('');
    setIsSending(true);

    try {
      await sendCompanionMessage(1, msg);
      await loadData();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Kolom Kiri: Pengingat Obat & Aktivitas (Juknis 5.4) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Pill className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-[#111111]">Jadwal Obat & Aktivitas</h3>
            </div>
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
              Pilar 3
            </span>
          </div>

          <p className="text-xs text-neutral-500 mb-4">
            AI Companion membacakan pengingat suara di jam tangan dan memvalidasi konfirmasi lansia secara otomatis.
          </p>

          <div className="space-y-3">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  rem.is_confirmed
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-neutral-50 border-neutral-200/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      rem.is_confirmed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-neutral-400 block tracking-wider">
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    rem.is_confirmed
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {rem.is_confirmed ? 'Sudah' : 'Konfirmasi'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Batasan Etis AI (Juknis 5.4 Wajib Ada) */}
        <div className="bg-neutral-900 text-white rounded-3xl p-5 border border-neutral-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Batasan Perilaku AI (Juknis 5.4)</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Asisten AI tidak memberikan diagnosis medis langsung. Respon difokuskan pada sapaan ramah,
            pendampingan emosi, konfirmasi obat, dan pengalihan ke kontak keluarga/tenaga medis jika ada keluhan serius.
          </p>
        </div>
      </div>

      {/* Kolom Kanan: Antarmuka Percakapan AI Check-in */}
      <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs flex flex-col h-[580px]">
        {/* Header Chat */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#111111] to-neutral-700 text-white flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111111]">AI Care Companion</h3>
              <p className="text-[11px] text-neutral-500">Pendamping Lansia Ramah Bahasa Indonesia</p>
            </div>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Siap Mendampingi
          </span>
        </div>

        {/* Chat History Box */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
          {messages.map((m) => {
            const isAI = m.sender === 'AI';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isAI
                      ? 'bg-neutral-100 text-neutral-900 rounded-tl-sm'
                      : 'bg-neutral-900 text-white rounded-tr-sm'
                  }`}
                >
                  <p>{m.message}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-neutral-400 font-medium">
                  <span>{new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.sentiment && m.sentiment !== 'NEUTRAL' && (
                    <span className="uppercase text-[9px] font-bold text-neutral-500">
                      • {m.sentiment}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSendMessage} className="pt-4 border-t border-neutral-100 mt-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik pesan dari Opa Budi (misal: 'Saya agak pusing nak', 'Sudah minum obat')..."
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="px-4 py-2.5 bg-neutral-900 text-white rounded-2xl text-xs font-bold hover:bg-neutral-800 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
