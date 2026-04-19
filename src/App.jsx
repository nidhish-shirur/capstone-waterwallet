import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WaterWalletProvider } from './context/WaterWalletContext';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import VirtualMeter from './views/VirtualMeter';
import MapStudio from './views/MapStudio';
import ROIDashboard from './views/ROIDashboard';

export default function App() {
  return (
    <WaterWalletProvider>
      <Router>
        <div className="flex min-h-screen bg-slate-50">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            
            <main className="flex-1 overflow-y-auto">
              <Routes>
                {/* Automatically redirect the root URL to Phase 1 */}
                <Route path="/" element={<Navigate to="/virtual-meter" replace />} />
                <Route path="/virtual-meter" element={<VirtualMeter />} />
                <Route path="/map-studio" element={<MapStudio />} />
                <Route path="/roi-dashboard" element={<ROIDashboard />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </WaterWalletProvider>
  );
}