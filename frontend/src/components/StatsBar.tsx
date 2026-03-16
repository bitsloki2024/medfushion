'use client';

import { motion } from 'framer-motion';
import { formatNumber } from '@/lib/utils';
import type { DiseaseKey } from '@/lib/disease-data';
import type { DISEASE_META } from '@/lib/disease-data';

interface Props {
  disease: DiseaseKey;
  totalCases: number;
  countriesAffected: number;
  activeAlerts: number;
  meta: typeof DISEASE_META[DiseaseKey];
}

export function StatsBar({ disease, totalCases, countriesAffected, activeAlerts, meta }: Props) {
  const stats = [
    { label: 'Countries Affected',  value: countriesAffected, color: '#3b82f6',  icon: '🌐' },
    { label: 'Total Cases',         value: formatNumber(totalCases), color: meta.color, icon: meta.icon },
    { label: 'Active Alerts',       value: activeAlerts,  color: '#ef4444',  icon: '🚨' },
    { label: 'Data Sources',        value: 9,             color: '#22c55e',  icon: '📡' },
    { label: 'ML Models Active',    value: 4,             color: '#a855f7',  icon: '🤖' },
    { label: 'Last Sync',           value: 'LIVE',        color: '#22d3ee',  icon: '⚡' },
  ];

  return (
    <footer className="flex-none z-20 border-t border-slate-800/50">
      <div
        className="px-4 py-2 flex items-center gap-0"
        style={{
          background: 'rgba(0,12,33,0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex-1 flex items-center gap-2 px-3 py-1 border-r border-slate-800/50 last:border-r-0"
          >
            <span className="text-base leading-none">{s.icon}</span>
            <div>
              <p className="stat-number text-sm font-bold leading-none" style={{ color: s.color }}>
                {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          </motion.div>
        ))}

        {/* Live indicator right */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800/50 ml-auto">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-dot" />
          <span className="text-[10px] text-green-400 font-mono tracking-widest">LIVE SURVEILLANCE</span>
        </div>
      </div>
    </footer>
  );
}
