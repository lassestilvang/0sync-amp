import { useParams } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { apiService } from '../services/api.service';
import { Clock, AlertCircle } from 'lucide-react';
import { SyncStatus } from '../types';

export default function SyncDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSync = useCallback(async (): Promise<void> => {
    try {
      const [syncRes, statusRes] = await Promise.all([
        apiService.getSync(id!),
        apiService.getSyncStatus(id!),
      ]);
      setSync(syncRes.data);
      setStatus(statusRes.data);
    } catch (error) {
      console.error('Failed to load sync', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void loadSync();
    }
  }, [id, loadSync]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!sync) {
    return <div className="p-8">Sync not found</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{sync.name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Current Status</p>
                <p className={`text-lg font-semibold ${sync.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                  {sync.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Direction</p>
                <p className="text-lg font-semibold text-gray-900">{sync.direction}</p>
              </div>
            </div>
          </div>

          {/* Sync History Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} />
              Sync History
            </h2>
            {status?.lastSyncAt ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Last Sync</p>
                <p className="text-gray-900">
                  {new Date(status.lastSyncAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-gray-600">No syncs yet</p>
            )}
          </div>

          {/* Error Card */}
          {sync.last_error && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
                <AlertCircle size={20} />
                Last Error
              </h2>
              <p className="text-red-800">{sync.last_error}</p>
              {sync.last_error_at && (
                <p className="text-sm text-red-600 mt-2">
                  {new Date(sync.last_error_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Conflicts</p>
            <p className="text-3xl font-bold text-gray-900">{status?.conflictCount || 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Retry Count</p>
            <p className="text-3xl font-bold text-gray-900">{status?.retryCount || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
