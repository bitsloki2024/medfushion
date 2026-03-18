'use client';

import { motion } from 'framer-motion';
import { DISEASE_META, REGIONS, INDIA_STATES } from '@/lib/disease-data';
import type { DiseaseKey } from '@/lib/disease-data';

interface Props {
  disease: DiseaseKey;
  region: string;
  isIndia: boolean;
  selectedState: string;
  onDiseaseChange: (d: DiseaseKey) => void;
  onRegionChange: (r: string) => void;
  onStateChange: (s: string) => void;
}

export function DiseaseSelector({
  disease, region, isIndia, selectedState,
  onDiseaseChange, onRegionChange, onStateChange,
}: Props) {
  const diseases = Object.entries(DISEASE_META) as [DiseaseKey, typeof DISEASE_META[DiseaseKey]][];
  const states = Object.keys(INDIA_STATES).sort();

  return (
    <div className="flex-none border-b border-slate-800/50 p-3 space-y-3 bg-[#000c1e]/60">
      {/* Disease selector */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Disease</label>
        <div className="grid grid-cols-5 gap-1">
          {diseases.map(([key, meta]) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onDiseaseChange(key)}
              className={`py-1.5 px-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all border ${
                disease === key
                  ? 'text-black font-bold border-transparent'
                  : 'text-slate-400 border-slate-700/50 hover:border-slate-600 bg-slate-900/40'
              }`}
              style={disease === key ? { background: meta.color, borderColor: meta.color } : {}}
            >
              <div className="leading-none truncate">{key === 'covid' ? 'COVID' : key === 'tb' ? 'TB' : meta.label.split(' ')[0]}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Region selector */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Region</label>
        <select
          value={region}
          onChange={e => onRegionChange(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-700/50 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em', paddingRight: '2rem' }}
        >
          {REGIONS.map(r => (
            <option key={r.value} value={r.value} style={{ background: '#001233' }}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* India state selector — appears when India is selected */}
      {isIndia && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">
            India — State / UT
          </label>
          <select
            value={selectedState}
            onChange={e => onStateChange(e.target.value)}
            className="w-full bg-slate-900/60 border border-orange-500/30 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-500/60 transition-colors appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em', paddingRight: '2rem' }}
          >
            <option value="" style={{ background: '#001233' }}>All States</option>
            {states.map(s => (
              <option key={s} value={s} style={{ background: '#001233' }}>{s}</option>
            ))}
          </select>
        </motion.div>
      )}
    </div>
  );
}
