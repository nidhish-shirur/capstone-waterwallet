import React from 'react';
import { Bell, Settings, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const phaseConfig = {
  'virtual-meter': {
    step: 'Phase 1',
    title: 'Virtual Meter Setup',
    subtitle: 'Configure society baseline parameters and import billing history',
  },
  'map-studio': {
    step: 'Phase 2',
    title: 'Hydrological Auditor',
    subtitle: 'Trace catchment surfaces and calculate rainwater harvesting potential',
  },
  'roi-dashboard': {
    step: 'Phase 3',
    title: 'Comparator Engine Output',
    subtitle: 'Financial simulation and return-on-investment analysis over 10 years',
  },
};

const fallbackConfig = {
  step: 'WaterWallet',
  title: 'WaterWallet Dashboard',
  subtitle: 'SaaS-based rainwater harvesting decision support system',
};

export default function Topbar() {
  const { pathname } = useLocation();
  // pathname is like '/virtual-meter' — strip the leading slash
  const key = pathname.replace('/', '');
  const config = phaseConfig[key] || fallbackConfig;

  return (
    <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">
            {config.step}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 leading-tight">{config.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{config.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          <Bell size={18} />
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          <Settings size={18} />
        </button>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm cursor-pointer">
          <User size={16} className="text-white" />
        </div>
      </div>
    </header>
  );
}
