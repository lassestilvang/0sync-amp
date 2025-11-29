import { useEffect, useState } from 'react';
import { apiService } from '../services/api.service';
import { useAuthStore } from '../hooks/useAuth';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await apiService.getProfile();
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to load profile', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="max-w-2xl">
          {/* Profile Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <p className="text-gray-900">{profile?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <p className="text-gray-900">{profile?.full_name || 'Not set'}</p>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">0Sync</span> v0.1.0
              </p>
              <p>Bi-directional synchronization platform</p>
              <a
                href="https://github.com"
                className="text-blue-600 hover:underline"
              >
                GitHub →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
