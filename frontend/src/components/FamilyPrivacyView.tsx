import React, { useState, useEffect } from 'react';
import {
  Users2,
  Phone,
  ShieldCheck,
  Lock,
  User,
} from 'lucide-react';
import type { EmergencyContact, ConsentItem, PatientInfo } from '../types/telemetry';
import {
  fetchEmergencyContacts,
  fetchConsents,
  toggleConsent,
  fetchPatients,
} from '../services/api';

export const FamilyPrivacyView: React.FC = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [patient, setPatient] = useState<PatientInfo | null>(null);

  const loadData = async () => {
    const [c, cn, pts] = await Promise.all([
      fetchEmergencyContacts(1),
      fetchConsents(1),
      fetchPatients(),
    ]);
    setContacts(c);
    setConsents(cn);
    if (pts.length > 0) setPatient(pts[0]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleConsent = async (id: number, current: boolean) => {
    await toggleConsent(id, !current);
    loadData();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Kolom Kiri: Profil Lansia & Kontak Darurat Bertingkat (Juknis 2.4 & 6.1) */}
      <div className="lg:col-span-6 space-y-6">
        {/* Kartu Profil Lansia */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <User className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                {patient?.patient_code || 'ELD-001'} • Rekam Medis
              </span>
              <h3 className="text-lg font-extrabold text-[#111111]">
                {patient?.full_name || 'Opa Budi Santoso'}
              </h3>
              <p className="text-xs text-neutral-500">
                Usia {patient?.age || 71} Tahun • {patient?.room_number || 'Kamar Utama (Lantai 1)'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/70 text-xs text-neutral-600">
            <span className="font-bold text-neutral-900 block mb-1">Kondisi Umum:</span>
            {patient?.condition_summary ||
              'Hipertensi terkontrol dengan Amlodipine 5mg. Riwayat pusing ringan saat perubahan posisi tidur ke berdiri.'}
          </div>
        </div>

        {/* Daftar Kontak Darurat Eskalasi (Pilar 4: Family Connection) */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Users2 className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-[#111111]">Eskalasi Kontak Darurat</h3>
            </div>
            <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-none">
              Hierarki Prioritas
            </span>
          </div>

          <p className="text-xs text-neutral-500 mb-4">
            Jika lansia tidak merespons alarm jatuh/anomali, sistem otomatis meneruskan notifikasi sesuai hierarki prioritas:
          </p>

          <div className="space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800">
                      Tingkat {c.priority_order}
                    </span>
                    {c.is_primary && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                        Keluarga Utama
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-neutral-900 mt-1">{c.name}</h4>
                  <p className="text-xs text-neutral-500">{c.relationship}</p>
                </div>

                <a
                  href={`tel:${c.phone_number}`}
                  className="px-3.5 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-900 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{c.phone_number}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Kepatuhan Privasi & Consent UU PDP No. 27/2022 (Juknis 8) */}
      <div className="lg:col-span-6 space-y-6">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-[#111111]">Persetujuan Data (UU PDP)</h3>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              UU No. 27/2022
            </span>
          </div>

          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
            Sesuai UU Pelindungan Data Pribadi (UU PDP), data biometrik kesehatan adalah data spesifik yang
            wajib memiliki persetujuan eksplisit dari lansia/wali dan dapat dicabut sewaktu-waktu.
          </p>

          <div className="space-y-3">
            {consents.map((cn) => (
              <div
                key={cn.id}
                className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-neutral-900">{cn.data_type}</h4>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        cn.is_granted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {cn.is_granted ? 'DIBERIKAN' : 'DICABUT'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-normal">
                    {cn.description}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleConsent(cn.id, cn.is_granted)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    cn.is_granted
                      ? 'bg-neutral-900 text-white hover:bg-rose-600'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {cn.is_granted ? 'Cabut' : 'Izinkan'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 p-3.5 rounded-none bg-neutral-900 text-white text-[11px] space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Standar Pengamanan Data Transit & At-Rest</span>
            </div>
            <p className="text-neutral-400">
              Enkripsi data transit (TLS/HTTPS), enkripsi database RDS Huawei Cloud, pembatasan akses berbasis peran (RBAC),
              dan audit log jejak waktu akses tersimpan aman.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
