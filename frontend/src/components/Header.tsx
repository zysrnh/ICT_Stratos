import React from 'react';
import { Radio, ShieldCheck, User } from 'lucide-react';
import type { PatientInfo } from '../types/telemetry';

interface HeaderProps {
  isOnline: boolean;
  alertCount: number;
  patients: PatientInfo[];
  selectedPatientId: number;
  onSelectPatient: (id: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  patients,
  selectedPatientId,
  onSelectPatient,
}) => {
  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pt-1">
      {/* Title & Status */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[#111111]">
            Hello Dr. Josh!
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Radio className={`w-3 h-3 ${isOnline ? 'animate-pulse text-emerald-600' : 'text-neutral-400'}`} />
            {isOnline ? 'IoT Cloud Connected' : 'Connecting RDS...'}
          </span>
        </div>
        <p className="text-xs text-neutral-400 font-medium mt-1">
          Real-time Biometrics & Early Warning System
        </p>
      </div>

      {/* Right Controls: Dynamic Patient Switcher & Doctor Profile */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
        {/* Dynamic Patient Switcher (Dropdown Rapi & Clean) */}
        {patients.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-neutral-200 shadow-xs">
            <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <select
              value={selectedPatientId}
              onChange={(e) => onSelectPatient(Number(e.target.value))}
              aria-label="Pilih Pasien"
              className="bg-transparent text-xs font-bold text-neutral-800 outline-none cursor-pointer pr-1"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} • {p.room_number}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Doctor Avatar Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-neutral-200">
          <div className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            DJ
          </div>
          <div className="hidden lg:block text-left text-xs">
            <div className="font-bold text-neutral-900 flex items-center gap-1">
              Dr. Joshua S.
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-neutral-400 font-medium text-[11px]">Head of Duty</div>
          </div>
        </div>
      </div>
    </header>
  );
};
