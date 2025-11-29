import { useAuthStore } from '../hooks/useAuth';
import { LogOut, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">0Sync</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.email}</span>
        <Link
          to="/settings"
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Settings"
        >
          <Settings size={20} />
        </Link>
        <button
          onClick={logout}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
