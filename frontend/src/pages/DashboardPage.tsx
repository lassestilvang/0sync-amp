import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { Plus, Play, Trash2 } from 'lucide-react';

interface Sync {
  id: string;
  name: string;
  status: string;
  source_integration: { provider: string };
  destination_integration: { provider: string };
  created_at: string;
}

export default function DashboardPage() {
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSyncs();
  }, []);

  const loadSyncs = async () => {
    try {
      const response = await apiService.getSyncs();
      setSyncs(response.data || []);
    } catch (error) {
      console.error('Failed to load syncs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (syncId: string) => {
    if (!confirm('Are you sure you want to delete this sync?')) return;

    try {
      await apiService.deleteSync(syncId);
      setSyncs(syncs.filter((s) => s.id !== syncId));
    } catch (error) {
      console.error('Failed to delete sync', error);
    }
  };

  const handleTrigger = async (syncId: string) => {
    try {
      await apiService.triggerSync(syncId);
      // Refresh sync status
      loadSyncs();
    } catch (error) {
      console.error('Failed to trigger sync', error);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Syncs</h1>
        <button
          onClick={() => navigate('/syncs/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          New Sync
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : syncs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-4">No syncs yet</p>
          <button
            onClick={() => navigate('/syncs/new')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Create your first sync
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {syncs.map((sync) => (
            <div
              key={sync.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/syncs/${sync.id}`)}>
                  <h3 className="text-lg font-semibold text-gray-900">{sync.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {sync.source_integration?.provider} →{' '}
                    {sync.destination_integration?.provider}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      sync.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {sync.status}
                  </span>
                  <button
                    onClick={() => handleTrigger(sync.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="Run sync"
                  >
                    <Play size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(sync.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition text-red-600"
                    title="Delete sync"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
