import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WaterWalletProvider } from './context/WaterWalletContext';
// AUTH TEMPORARILY DISABLED — re-enable by uncommenting AuthProvider/ProtectedRoute below
// import { AuthProvider, useAuth } from './context/AuthContext';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import VirtualMeter from './views/VirtualMeter';
import MapStudio from './views/MapStudio';
import ROIDashboard from './views/ROIDashboard';
// import AuthPage from './views/AuthPage';

// function ProtectedRoute({ children }) {
//   const { user, loading } = useAuth();
//   if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
//   if (!user) return <Navigate to="/login" replace />;
//   return children;
// }

export default function App() {
  return (
    // AUTH TEMPORARILY DISABLED — wrap with <AuthProvider> when re-enabling
    <WaterWalletProvider>
      <Router>
        <Routes>
          {/* <Route path="/login" element={<AuthPage />} /> */}
          <Route path="/*" element={
            <div className="flex min-h-screen bg-slate-50">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Topbar />
                <main className="flex-1 overflow-y-auto">
                  <Routes>
                    <Route path="/" element={<Navigate to="/virtual-meter" replace />} />
                    <Route path="/virtual-meter" element={<VirtualMeter />} />
                    <Route path="/map-studio" element={<MapStudio />} />
                    <Route path="/roi-dashboard" element={<ROIDashboard />} />
                  </Routes>
                </main>
              </div>
            </div>
          } />
        </Routes>
      </Router>
    </WaterWalletProvider>
  );
}