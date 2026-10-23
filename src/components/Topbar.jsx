import React from 'react';
import { Bell, User, ArrowUpRight, LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { user, logout } = useAuth();
  
  // pathname is like '/virtual-meter' — strip the leading slash
  const key = pathname.replace('/', '');
  const config = phaseConfig[key] || fallbackConfig;

  return (
    <header className="app-topbar bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="eyebrow text-[11px] font-bold text-blue-700 uppercase tracking-[0.16em] bg-blue-50 px-2.5 py-1 rounded-full">
            {config.step}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-950 leading-tight tracking-tight">{config.title}</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">{config.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {user?.isGuest ? (
          <div className="flex items-center gap-2 mr-1">
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Guest Mode
            </span>
            <button
              onClick={logout}
              title="Sign in with an account"
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border-0 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        ) : user ? (
          <div className="flex items-center gap-2 mr-1">
            <span className="text-xs font-medium text-slate-600 max-w-[140px] sm:max-w-[200px] truncate" title={user.email}>
              {user.email}
            </span>
            <button
              onClick={logout}
              title="Sign out"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors border-0 bg-transparent cursor-pointer"
            >
              <LogOut size={17} />
            </button>
          </div>
        ) : null}
        <button aria-label="Open notifications" className="icon-button w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          <Bell size={18} />
        </button>
        <button aria-label="Open profile" className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm cursor-pointer border-0">
          <User size={16} className="text-white" />
        </button>
        <ArrowUpRight size={15} className="hidden sm:block text-slate-300" aria-hidden="true" />
      </div>
    </header>
  );
}
