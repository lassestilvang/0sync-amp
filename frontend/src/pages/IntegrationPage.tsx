import { useEffect, useState } from 'react';
import { apiService } from '../services/api.service';
import { Plug2, X } from 'lucide-react';

const PROVIDERS = [
  { id: 'notion', name: 'Notion', icon: '🔷' },
  { id: 'todoist', name: 'Todoist', icon: '✓' },
  { id: 'google_calendar', name: 'Google Calendar', icon: '📅' },
  { id: 'google_tasks', name: 'Google Tasks', icon: '☑️' },
  { id: 'google_contacts', name: 'Google Contacts', icon: '👥' },
  { id: 'google_sheets', name: 'Google Sheets', icon: '📊' },
  { id: 'microsoft_todo', name: 'Microsoft To-Do', icon: '✔️' },
  { id: 'outlook_calendar', name: 'Outlook Calendar', icon: '📆' },
];

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: string;
  created_at: string;
}

export default function IntegrationPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const response = await apiService.getIntegrations();
      setIntegrations(response.data || []);
    } catch (error) {
      console.error('Failed to load integrations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    try {
      const response = await apiService.getOAuthUrl(provider);
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to get OAuth URL', error);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      await apiService.disconnectIntegration(id);
      setIntegrations(integrations.filter((i) => i.id !== id));
    } catch (error) {
      console.error('Failed to disconnect integration', error);
    }
  };

  const getProvider = (providerId: string) => {
    return PROVIDERS.find((p) => p.id === providerId);
  };

  const connectedProviders = new Set(integrations.map((i) => i.provider));

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
      <p className="text-gray-600 mb-8">Connect your favorite apps and services</p>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div>
          {/* Connected Integrations */}
          {integrations.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Connected</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.map((integ) => {
                  const provider = getProvider(integ.provider);
                  return (
                    <div
                      key={integ.id}
                      className="bg-white rounded-lg border border-gray-200 p-6"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-2xl mb-2">{provider?.icon}</div>
                          <h3 className="font-semibold text-gray-900">{provider?.name}</h3>
                        </div>
                        <button
                          onClick={() => handleDisconnect(integ.id)}
                          className="p-1 hover:bg-red-100 rounded transition"
                          title="Disconnect"
                        >
                          <X size={18} className="text-red-600" />
                        </button>
                      </div>
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Connected
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Providers */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Available</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PROVIDERS.filter((p) => !connectedProviders.has(p.id)).map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleConnect(provider.id)}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition text-left"
                >
                  <div className="text-2xl mb-2">{provider.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{provider.name}</h3>
                  <span className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    <Plug2 size={16} />
                    Connect
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
