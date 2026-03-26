import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen sky-gradient font-space">
      <main className="relative">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}