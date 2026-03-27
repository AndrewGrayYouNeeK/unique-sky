import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';

// Pages
import ARSkyView from './pages/ARSkyView';
import NameAStar from './pages/NameAStar';
import DailyHunts from './pages/DailyHunts';
import StarMap from './pages/StarMap';
import Profile from './pages/Profile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 sky-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border border-star-gold/20 animate-pulse" />
            <div className="absolute inset-2 rounded-full border border-star-gold/40" />
            <div className="absolute inset-4 rounded-full bg-star-gold/20 flex items-center justify-center">
              <span className="text-star-gold text-xl">✦</span>
            </div>
          </div>
          <p className="nebula-text font-space font-bold text-xl">YouneeK Stars</p>
          <p className="text-muted-foreground text-sm mt-1">Loading the cosmos...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

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
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;