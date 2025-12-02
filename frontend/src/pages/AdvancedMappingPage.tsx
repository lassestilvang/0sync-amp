import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { Plus, Trash2, Save } from 'lucide-react';

interface FieldMapping {
  sourceField: string;
  destinationField: string;
  transform?: string;
  defaultValue?: string;
}

interface SyncConfig {
  id: string;
  name: string;
  source_provider: string;
  destination_provider: string;
  field_mappings: FieldMapping[];
  source_fields: Array<{ name: string; type: string }>;
  destination_fields: Array<{ name: string; type: string }>;
}

const TRANSFORM_TEMPLATES = [
  { value: 'identity', label: 'No Transform' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'trim', label: 'Trim Whitespace' },
  { value: 'concatenate', label: 'Concatenate Fields' },
  { value: 'format_date', label: 'Format Date' },
  { value: 'custom', label: 'Custom Function' },
];

export default function AdvancedMappingPage() {
  const { syncId } = useParams<{ syncId: string }>();
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const loadSyncConfig = useCallback(async (): Promise<void> => {
    try {
      const response = await apiService.getSyncDetail(syncId!);
      setConfig(response.data);
      setMappings((response.data as SyncConfig).field_mappings || []);
    } catch (error) {
      console.error('Failed to load sync config', error);
    } finally {
      setLoading(false);
    }
  }, [syncId]);

  useEffect(() => {
    void loadSyncConfig();
  }, [syncId, loadSyncConfig]);

  const handleAddMapping = () => {
    setMappings([
      ...mappings,
      { sourceField: '', destinationField: '', transform: 'identity' },
    ]);
    setEditingIndex(mappings.length);
  };

  const handleUpdateMapping = (index: number, field: string, value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  const handleSave = async () => {
    if (!syncId) return;

    setSaving(true);
    try {
      await apiService.updateSyncFieldMapping(syncId, mappings);
      setEditingIndex(null);
      // Reload to confirm changes
      await loadSyncConfig();
    } catch (error) {
      console.error('Failed to save field mappings', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!config) {
    return <div className="p-8 text-center text-red-500">Failed to load sync configuration</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Field Mapping</h1>
        <p className="text-gray-600">{config.name}</p>
        <p className="text-sm text-gray-500 mt-1">
          {config.source_provider} → {config.destination_provider}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Legend */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Source Fields</h3>
              <p className="text-xs text-gray-600">
                {config.source_fields.length} available fields from {config.source_provider}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Destination Fields</h3>
              <p className="text-xs text-gray-600">
                {config.destination_fields.length} available fields in {config.destination_provider}
              </p>
            </div>
          </div>
        </div>

        {/* Mapping Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Source Field
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Transform
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Destination Field
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Default Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No field mappings configured. Add one to get started.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping, index) => (
                  <tr
                    key={index}
                    className={editingIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-6 py-4">
                      <select
                        value={mapping.sourceField}
                        onChange={(e) =>
                          handleUpdateMapping(index, 'sourceField', e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select field...</option>
                        {config.source_fields.map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.name} ({field.type})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <select
                        value={mapping.transform || 'identity'}
                        onChange={(e) =>
                          handleUpdateMapping(index, 'transform', e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {TRANSFORM_TEMPLATES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <select
                        value={mapping.destinationField}
                        onChange={(e) =>
                          handleUpdateMapping(index, 'destinationField', e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select field...</option>
                        {config.destination_fields.map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.name} ({field.type})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={mapping.defaultValue || ''}
                        onChange={(e) =>
                          handleUpdateMapping(index, 'defaultValue', e.target.value)
                        }
                        placeholder="Optional default"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveMapping(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete mapping"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Mapping Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleAddMapping}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-900 font-medium"
          >
            <Plus size={16} />
            Add Mapping
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={() => loadSyncConfig()}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-900 font-medium"
        >
          Discard Changes
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition font-medium"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Mappings'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Transform Functions</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>
            <strong>No Transform:</strong> Copy field value as-is
          </li>
          <li>
            <strong>Uppercase/Lowercase:</strong> Convert text case
          </li>
          <li>
            <strong>Trim:</strong> Remove leading/trailing whitespace
          </li>
          <li>
            <strong>Concatenate:</strong> Combine multiple fields
          </li>
          <li>
            <strong>Format Date:</strong> Convert date formats
          </li>
          <li>
            <strong>Custom:</strong> Write JavaScript function body
          </li>
        </ul>
      </div>
    </div>
  );
}
