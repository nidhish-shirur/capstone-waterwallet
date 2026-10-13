import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WaterWalletProvider } from './context/WaterWalletContext';
import { AuthProvider, useAuth } from './context/AuthContext';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import VirtualMeter from './views/VirtualMeter';
import MapStudio from './views/MapStudio';
import ROIDashboard from './views/ROIDashboard';
import AuthPage from './views/AuthPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <WaterWalletProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/*" element={<ProtectedRoute><div className="app-shell flex min-h-screen bg-slate-50">
              <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg">
                Skip to main content
              </a>
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Topbar />
                <main id="main-content" className="flex-1 overflow-y-auto">
                  <Routes>
                    <Route path="/" element={<Navigate to="/virtual-meter" replace />} />
                    <Route path="/virtual-meter" element={<VirtualMeter />} />
                    <Route path="/map-studio" element={<MapStudio />} />
                    <Route path="/roi-dashboard" element={<ROIDashboard />} />
                  </Routes>
                </main>
              </div>
            </div></ProtectedRoute>} />
        </Routes>
      </Router>
      </WaterWalletProvider>
    </AuthProvider>
  );
}