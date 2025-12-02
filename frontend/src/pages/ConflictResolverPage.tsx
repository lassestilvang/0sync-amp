import { useEffect, useState } from 'react';
import { apiService } from '../services/api.service';
import { AlertCircle, Check } from 'lucide-react';

interface ConflictedObject {
  id: string;
  sync_id: string;
  sync_name: string;
  source_object_id: string;
  destination_object_id: string;
  source_data: Record<string, unknown>;
  destination_data: Record<string, unknown>;
  conflict_detected_at: string;
  resolution_strategy: 'last_write_wins' | 'manual' | 'keep_both' | 'ignore';
}

export default function ConflictResolverPage() {
  const [conflicts, setConflicts] = useState<ConflictedObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConflict, setSelectedConflict] = useState<ConflictedObject | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);

  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    try {
      const response = await apiService.getConflicts({ limit: 100 });
      setConflicts(response.data || []);
    } catch (error) {
      console.error('Failed to load conflicts', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedConflict || !selectedResolution) return;

    try {
      await apiService.resolveConflict(selectedConflict.id, {
        resolution: selectedResolution,
      });

      setConflicts(conflicts.filter((c) => c.id !== selectedConflict.id));
      setSelectedConflict(null);
      setSelectedResolution(null);
    } catch (error) {
      console.error('Failed to resolve conflict', error);
    }
  };

  const pendingConflicts = conflicts.filter((c) => c.resolution_strategy === 'manual');
  const autoResolved = conflicts.filter((c) => c.resolution_strategy !== 'manual');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conflict Resolver</h1>
        <p className="text-gray-600">Resolve data conflicts between synced services</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading conflicts...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conflicts List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  Conflicts ({conflicts.length})
                </h2>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {conflicts.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No conflicts detected
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {conflicts.map((conflict) => (
                      <button
                        key={conflict.id}
                        onClick={() => setSelectedConflict(conflict)}
                        className={`w-full px-6 py-4 text-left transition ${
                          selectedConflict?.id === conflict.id
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {conflict.resolution_strategy === 'manual' ? (
                            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
                          ) : (
                            <Check className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">
                              {conflict.sync_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(conflict.conflict_detected_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Statistics */}
            <div className="mt-6 space-y-2">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-sm font-medium text-red-900">Manual Conflicts</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{pendingConflicts.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm font-medium text-green-900">Auto-Resolved</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{autoResolved.length}</p>
              </div>
            </div>
          </div>

          {/* Conflict Details */}
          <div className="lg:col-span-2">
            {selectedConflict ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {selectedConflict.sync_name}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Source Data */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Source Data</h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      {Object.entries(selectedConflict.source_data).map(([key, value]) => (
                        <div key={key} className="mb-3 last:mb-0">
                          <p className="text-xs font-semibold text-gray-600 uppercase">
                            {key}
                          </p>
                          <p className="text-sm text-gray-900 break-words mt-1">
                            {typeof value === 'object'
                              ? JSON.stringify(value, null, 2)
                              : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Destination Data */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Destination Data</h3>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      {Object.entries(selectedConflict.destination_data).map(([key, value]) => (
                        <div key={key} className="mb-3 last:mb-0">
                          <p className="text-xs font-semibold text-gray-600 uppercase">
                            {key}
                          </p>
                          <p className="text-sm text-gray-900 break-words mt-1">
                            {typeof value === 'object'
                              ? JSON.stringify(value, null, 2)
                              : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedConflict.resolution_strategy === 'manual' && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Resolution Strategy</h3>
                    <div className="space-y-2 mb-6">
                      {[
                        {
                          value: 'use_source',
                          label: 'Use Source Data',
                          description: 'Keep source, overwrite destination',
                        },
                        {
                          value: 'use_destination',
                          label: 'Use Destination Data',
                          description: 'Keep destination, discard source',
                        },
                        {
                          value: 'keep_both',
                          label: 'Keep Both',
                          description: 'Create a copy in destination',
                        },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="radio"
                            name="resolution"
                            value={option.value}
                            checked={selectedResolution === option.value}
                            onChange={(e) => setSelectedResolution(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="ml-3 flex-1">
                            <p className="font-medium text-gray-900">{option.label}</p>
                            <p className="text-sm text-gray-600">{option.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleResolve}
                        disabled={!selectedResolution}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition font-medium"
                      >
                        Resolve Conflict
                      </button>
                      <button
                        onClick={() => setSelectedConflict(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
                <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">Select a conflict to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
