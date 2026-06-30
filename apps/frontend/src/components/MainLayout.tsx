import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="workspace-shell">
      <Sidebar />
      <div className="main-panel">
        <Header />
        <Outlet />
      </div>
    </div>
  );
}