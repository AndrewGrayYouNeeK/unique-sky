import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import AppLayout from '@/components/layout/AppLayout';

import ARSkyView from './pages/ARSkyView';
import NameAStar from './pages/NameAStar';
import DailyHunts from './pages/DailyHunts';
import StarMap from './pages/StarMap';
import Profile from './pages/Profile';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ARSkyView />} />
        <Route path="/name-a-star" element={<NameAStar />} />
        <Route path="/hunts" element={<DailyHunts />} />
        <Route path="/star-map" element={<StarMap />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
