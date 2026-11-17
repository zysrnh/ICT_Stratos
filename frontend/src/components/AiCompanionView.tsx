import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Pill,
  Send,
  Heart,
  Footprints,
  Coffee,
  RotateCcw,
  Check,
  Info,
  MessageCircleHeart,
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
      loadData();
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

  const renderCategoryIcon = (type: ReminderItem['reminder_type'], isConfirmed: boolean) => {
    const tint = isConfirmed
      ? 'bg-[#F0FDF4] text-[#15803D]'
      : type === 'MEDICINE'
      ? 'bg-[#FFFBEB] text-[#B45309]'
      : type === 'ACTIVITY'
      ? 'bg-[#F0FDF4] text-[#15803D]'
      : 'bg-[#FEF2F2] text-[#DC2626]';

    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
        {type === 'MEDICINE' ? (
          <Pill className="w-[18px] h-[18px]" aria-hidden="true" />
        ) : type === 'ACTIVITY' ? (
          <Footprints className="w-[18px] h-[18px]" aria-hidden="true" />
        ) : (
          <MessageCircleHeart className="w-[18px] h-[18px]" aria-hidden="true" />
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
      {/* Kolom Kiri: Jadwal Obat & Aktivitas */}
      <div className="lg:col-span-5 space-y-6 min-w-0 w-full">
        <section aria-label="Jadwal obat dan aktivitas" className="hc-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[#18181B]">Jadwal obat &amp; aktivitas</h2>
            <p className="text-[13px] text-[#52525B] mt-1">
              Pengingat harian dan konfirmasi rutin untuk {patientName}.
            </p>
          </div>

          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="p-5 rounded-[16px] bg-[#FAF9F7] border border-[#E5E3DD] text-[15px] text-[#5C5C66] text-center">
                Belum ada jadwal yang tercatat untuk saat ini.
              </div>
            ) : (
              reminders.map((rem) => (
                <div
                  key={rem.id}
                  className={`p-4 rounded-[16px] border transition-colors flex items-center justify-between gap-3 ${
                    rem.is_confirmed
                      ? 'bg-[#FAF9F7] border-[#E5E3DD]'
                      : 'bg-white border-[#E5E3DD]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {renderCategoryIcon(rem.reminder_type, rem.is_confirmed)}

                    <div className="min-w-0">
                      <span className="text-[13px] text-[#52525B] block">
                        {rem.time_scheduled} WIB
                      </span>
                      <h3
                        className={`text-[15px] font-medium leading-snug [overflow-wrap:anywhere] ${
                          rem.is_confirmed ? 'text-[#5C5C66]' : 'text-[#18181B]'
                        }`}
                      >
                        {rem.title}
                      </h3>
                      {rem.is_confirmed && rem.confirmed_at && (
                        <span className="text-[13px] text-[#166534] block mt-0.5">
                          Selesai pukul{' '}
                          {new Date(rem.confirmed_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item selesai = centang hijau + teks redup; item belum = tombol Konfirmasi */}
                  {rem.is_confirmed ? (
                    <button
                      type="button"
                      onClick={() => handleToggleReminder(rem.id, rem.is_confirmed)}
                      aria-label={`Tandai ${rem.title} belum selesai`}
                      title="Tandai belum selesai"
                      className="w-11 h-11 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] flex items-center justify-center shrink-0 cursor-pointer hover:bg-green-100/70 transition-colors"
                    >
                      <Check className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleReminder(rem.id, rem.is_confirmed)}
                      className="hc-btn-secondary px-3.5 py-2 text-[13px] shrink-0 cursor-pointer"
                    >
                      Konfirmasi
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Catatan Etika AI Lembut */}
        <div className="rounded-[20px] bg-[#FFFBEB] border border-[#FDE68A] p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] text-[#92400E] leading-relaxed">
            Pendamping membantu menyapa dan mengingatkan jadwal harian, bukan pengganti diagnosis dokter.
          </p>
        </div>
      </div>

      {/* Kolom Kanan: Percakapan Pendamping */}
      <section
        aria-label="Obrolan dengan Sahabat Peduli"
        className="lg:col-span-7 hc-card p-5 sm:p-6 flex flex-col min-w-0 w-full h-[620px] max-h-[82vh] overflow-hidden"
      >
        {/* Header Chat */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E3DD] mb-4 shrink-0 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#18181B] truncate">Sahabat Peduli</h2>
              <p className="text-[13px] text-[#52525B] truncate">
                Pendamping percakapan untuk {patientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              <span className="w-2 h-2 rounded-full bg-[#15803D]" />
              <span>Siap</span>
            </span>

            <button
              type="button"
              onClick={handleClearChat}
              aria-label="Bersihkan percakapan dan mulai sesi baru"
              title="Mulai sesi obrolan baru"
              className="hc-btn-secondary w-11 h-11 sm:w-auto sm:px-3.5 flex items-center justify-center gap-2 text-[13px] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
              <span className="hidden sm:inline">Mulai ulang</span>
            </button>
          </div>
        </div>

        {/* Quick Reply Pill */}
        <div className="mb-4 shrink-0 flex items-center gap-2 overflow-x-auto pb-1 w-full min-w-0">
          <button
            type="button"
            onClick={() => handleSendPrompt('Bagaimana detak jantung saya sekarang nak?')}
            disabled={isSending}
            className="hc-chip min-h-[44px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#18181B] shrink-0 cursor-pointer"
          >
            <Heart className="w-4 h-4 text-[#DC2626]" aria-hidden="true" />
            <span>Detak jantung saya</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Apakah ada jadwal obat yang harus saya minum sekarang?')}
            disabled={isSending}
            className="hc-chip min-h-[44px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#18181B] shrink-0 cursor-pointer"
          >
            <Pill className="w-4 h-4 text-[#B45309]" aria-hidden="true" />
            <span>Jadwal obat</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Sudah berapa langkah saya jalan hari ini?')}
            disabled={isSending}
            className="hc-chip min-h-[44px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#18181B] shrink-0 cursor-pointer"
          >
            <Footprints className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            <span>Langkah hari ini</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Halo nak, mau ngobrol santai sebentar')}
            disabled={isSending}
            className="hc-chip min-h-[44px] bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E5E3DD] text-[#18181B] shrink-0 cursor-pointer"
          >
            <Coffee className="w-4 h-4 text-[#52525B]" aria-hidden="true" />
            <span>Ngobrol santai</span>
          </button>
        </div>

        {/* Area Pesan */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto space-y-4 rounded-[20px] border border-[#E5E3DD] bg-[#FAF9F7] p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#52525B]">
              <div className="w-12 h-12 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center mb-3">
                <Bot className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-[16px] font-medium text-[#18181B]">Belum ada percakapan</p>
              <p className="text-[14px] text-[#52525B] mt-1 max-w-sm">
                Pilih pertanyaan cepat di atas atau ketik pesan di bawah untuk menyapa Sahabat Peduli.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isAI = m.sender === 'AI';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col min-w-0 ${isAI ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] min-w-0 px-4 py-3 rounded-[20px] text-base sm:text-[17px] leading-[1.6] [overflow-wrap:anywhere] hc-fade-soft ${
                      isAI
                        ? 'bg-white border border-[#E5E3DD] text-[#18181B]'
                        : 'bg-[#15803D] text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.message}</p>
                  </div>
                  <span className="mt-1.5 px-1.5 text-[13px] text-[#5C5C66]">
                    {new Date(m.created_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })
          )}

          {/* Indikator Mengetik */}
          {isTyping && (
            <div className="flex flex-col items-start hc-fade-soft">
              <div className="bg-white border border-[#E5E3DD] px-4 py-3 rounded-[20px] text-[15px] text-[#52525B] flex items-center gap-2.5">
                <span>Sahabat Peduli sedang mengetik</span>
                <span className="flex gap-1 items-center" aria-hidden="true">
                  <span className="w-1.5 h-1.5 bg-[#15803D] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[#15803D] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-[#15803D] rounded-full animate-bounce [animation-delay:0.4s]" />
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Membulat & Tombol Kirim Bulat */}
        <form onSubmit={handleFormSubmit} className="pt-4 mt-1 shrink-0 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Tulis pesan untuk ${patientName}...`}
              aria-label="Tulis pesan untuk Sahabat Peduli"
              disabled={isSending}
              className="flex-1 min-w-0 min-h-[48px] bg-white border border-[#E5E3DD] focus:border-[#18181B] rounded-full px-5 py-2.5 text-[15px] sm:text-base text-[#18181B] placeholder:text-[#71717A] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              aria-label="Kirim pesan"
              className="w-12 h-12 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white disabled:opacity-40 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AiCompanionView;
