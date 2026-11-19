import React, { useState, useEffect } from 'react';
import {
  Users2,
  Phone,
  ShieldCheck,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { EmergencyContact, ConsentItem, PatientInfo, AuthSession } from '../types/telemetry';
import {
  fetchEmergencyContacts,
  fetchConsents,
  toggleConsent,
  fetchPatients,
} from '../services/api';

interface FamilyPrivacyViewProps {
  session?: AuthSession | null;
}

export const FamilyPrivacyView: React.FC<FamilyPrivacyViewProps> = ({ session }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [patient, setPatient] = useState<PatientInfo | null>(null);

  const activePatientId = session?.patient_id || 1;

  const loadData = async () => {
    const [c, cn, pts] = await Promise.all([
      fetchEmergencyContacts(activePatientId),
      fetchConsents(activePatientId),
      fetchPatients(),
    ]);
    setContacts(c);
    setConsents(cn);
    if (pts.length > 0) {
      const current = pts.find((p) => p.id === activePatientId) || pts[0];
      setPatient(current);
    }
  };

  useEffect(() => {
    loadData();
  }, [activePatientId]);

  const handleToggleConsent = async (id: number, current: boolean) => {
    await toggleConsent(id, !current);
    loadData();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
      {/* Kolom Kiri: Profil Lansia & Kontak Darurat */}
      <div className="lg:col-span-6 space-y-6 min-w-0">
        {/* Kartu Profil Lansia */}
        <section aria-label="Profil lansia" className="hc-card p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-[#F3F2EE] text-[#18181B] flex items-center justify-center shrink-0">
              <User className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#18181B] truncate">
                {patient?.full_name || session?.patient_name || 'Opa Budi Santoso'}
              </h2>
              <p className="text-[14px] text-[#52525B] mt-0.5">
                Usia {patient?.age || 71} tahun ·{' '}
                {patient?.gender === 'FEMALE' ? 'Perempuan' : 'Laki-laki'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[16px] bg-[#FAF9F7] border border-[#E5E3DD] text-[14px] text-[#52525B] leading-relaxed">
            <span className="font-semibold text-[#18181B] block mb-1">Catatan kesehatan</span>
            {patient?.condition_summary ||
              'Hipertensi terkontrol dengan Amlodipine 5mg. Riwayat pusing ringan saat perubahan posisi tidur ke berdiri.'}
          </div>
        </section>

        {/* Daftar Kontak Darurat */}
        <section aria-label="Kontak darurat keluarga" className="hc-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <Users2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-[#18181B]">Kontak darurat</h2>
            </div>
            <span className="hc-chip bg-[#FAF9F7] text-[#52525B] border border-[#E5E3DD]">
              Urutan prioritas
            </span>
          </div>

          <p className="text-[14px] text-[#52525B] mb-5 leading-relaxed">
            Jika lansia tidak merespons jam tangan saat darurat, pemberitahuan diteruskan sesuai urutan berikut:
          </p>

          <div className="space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-[16px] bg-[#FAF9F7] border border-[#E5E3DD] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="hc-chip bg-white text-[#52525B] border border-[#E5E3DD]">
                      Prioritas {c.priority_order}
                    </span>
                    {c.is_primary ? (
                      <span className="hc-chip bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                        Kontak utama
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#18181B] truncate">{c.name}</h3>
                  <p className="text-[13px] text-[#52525B]">{c.relationship}</p>
                </div>

                <a
                  href={`tel:${c.phone_number}`}
                  aria-label={`Hubungi ${c.name} di ${c.phone_number}`}
                  className="hc-btn-secondary px-4 py-2.5 text-[14px] inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                  <span>{c.phone_number}</span>
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Kolom Kanan: Persetujuan Data (UU PDP) */}
      <div className="lg:col-span-6 space-y-6 min-w-0">
        <section aria-label="Persetujuan data pribadi" className="hc-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-[#18181B]">Persetujuan data</h2>
            </div>
            <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              UU No. 27/2022
            </span>
          </div>

          <p className="text-[14px] text-[#52525B] mb-5 leading-relaxed">
            Pengambilan data kesehatan memerlukan persetujuan lansia atau wali keluarga dan dapat diubah kapan saja.
          </p>

          <div className="space-y-3">
            {consents.map((cn) => (
              <div
                key={cn.id}
                className="p-4 rounded-[16px] bg-[#FAF9F7] border border-[#E5E3DD] flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[#18181B]">{cn.data_type}</h3>
                    {cn.is_granted ? (
                      <span className="hc-chip bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                        <span>Diizinkan</span>
                      </span>
                    ) : (
                      <span className="hc-chip bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                        <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                        <span>Nonaktif</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#52525B] mt-1.5 leading-relaxed">
                    {cn.description}
                  </p>
                </div>

                {/* Toggle Pill Konsisten (Tap target >= 44px) */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={cn.is_granted}
                  aria-label={`${cn.data_type}: ${cn.is_granted ? 'Aktif' : 'Nonaktif'}`}
                  onClick={() => handleToggleConsent(cn.id, cn.is_granted)}
                  className="min-w-[48px] min-h-[44px] flex items-center justify-end shrink-0 cursor-pointer"
                >
                  <span
                    className={`inline-flex items-center w-12 h-7 p-0.5 rounded-full transition-colors duration-180 ${
                      cn.is_granted ? 'bg-[#15803D]' : 'bg-[#D4D1C9]'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-180 ease-out ${
                        cn.is_granted ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-[16px] bg-[#F0FDF4] border border-[#BBF7D0] flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-[13px] text-[#166534] leading-relaxed">
              <span className="font-semibold block">Data terjaga &amp; terenkripsi</span>
              Komunikasi antar perangkat dan penyimpanan riwayat keluarga terlindungi oleh enkripsi standar.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FamilyPrivacyView;
