import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ShieldProvider } from './lib/shield';
import { Shell } from './components/Shell';
import { Landing } from './pages/Landing';
import { Overview } from './pages/Overview';
import { Agents } from './pages/Agents';
import { Claims } from './pages/Claims';
import { ClaimDetail } from './pages/ClaimDetail';
import { Audit } from './pages/Audit';
import { Disputes } from './pages/Disputes';
import { Activity } from './pages/Activity';

export default function App() {
  return (
    <ShieldProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/*"
            element={
              <Shell>
                <Routes>
                  <Route path="overview" element={<Overview />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="claims" element={<Claims />} />
                  <Route path="claims/:id" element={<ClaimDetail />} />
                  <Route path="audit" element={<Audit />} />
                  <Route path="disputes" element={<Disputes />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="*" element={<Navigate to="/overview" replace />} />
                </Routes>
              </Shell>
            }
          />
        </Routes>
      </HashRouter>
    </ShieldProvider>
  );
}
