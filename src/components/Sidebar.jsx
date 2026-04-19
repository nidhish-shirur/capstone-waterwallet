import React from 'react';
import { Droplets, Map, BarChart3, Gauge } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { id: 'virtual-meter',  label: 'Step 1: Virtual Meter',  icon: Gauge },
  { id: 'map-studio',     label: 'Step 2: Map Studio',     icon: Map },
  { id: 'roi-dashboard',  label: 'Step 3: ROI Dashboard',  icon: BarChart3 },
];

export default function Sidebar() {
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  const activeTab  = pathname.replace('/', '');

  return (
    <aside className="w-64 min-h-screen bg-white shadow-md flex flex-col flex-shrink-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-6 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center shadow-sm">
          <Droplets size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold text-blue-700 tracking-tight">WaterWallet</span>
      </div>

      {/* Nav label */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Navigation</p>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => navigate(`/${id}`)}
              className={`nav-item w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-left text-sm font-medium cursor-pointer border-none outline-none
                ${isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <Icon
                size={18}
                className={isActive ? 'text-blue-600' : 'text-slate-400'}
              />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-5 rounded-full bg-blue-600"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-slate-100">
        <p className="text-xs text-slate-400 leading-relaxed">
          v1.0 · Rainwater Harvesting Intelligence Platform
        </p>
      </div>
    </aside>
  );
}
