import { useEffect, useState } from 'react';
import { apiService } from '../services/api.service';
import { ChevronDown, Download } from 'lucide-react';

interface SyncLog {
  id: string;
  sync_id: string;
  sync_name: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, unknown>;
  created_at: string;
  timestamp: string;
}

const LOG_LEVELS = {
  info: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  warn: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100' },
  error: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' },
  debug: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async () => {
    try {
      const response = await apiService.getSyncLogs({ limit: 100 });
      setLogs(response.data || []);
    } catch (error) {
      console.error('Failed to load logs', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs
    .filter((log) => filter === 'all' || log.level === filter)
    .filter((log) =>
      searchTerm === '' ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sync_name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Sync Name', 'Level', 'Message'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.timestamp,
          log.sync_name,
          log.level.toUpperCase(),
          `"${log.message.replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `0sync-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getLogStyles = (level: SyncLog['level']) => LOG_LEVELS[level];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sync Logs</h1>
        <p className="text-gray-600">Monitor and debug all sync operations</p>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex bg-white border border-gray-300 rounded-lg">
              {(['all', 'info', 'warn', 'error'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilter(level)}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    filter === level
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={exportLogs}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Logs List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No logs found</div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const styles = getLogStyles(log.level);
            const isExpanded = expandedLogs.has(log.id);

            return (
              <div
                key={log.id}
                className={`rounded-lg border border-gray-200 overflow-hidden transition ${styles.bg}`}
              >
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="w-full px-6 py-4 flex items-start gap-4 hover:bg-opacity-75 transition"
                >
                  <ChevronDown
                    size={20}
                    className={`flex-shrink-0 mt-0.5 transition transform ${
                      isExpanded ? 'rotate-180' : ''
                    } ${styles.text}`}
                  />

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${styles.badge}`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900">{log.sync_name}</span>
                    </div>
                    <p className={`${styles.text} text-sm`}>{log.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </button>

                {isExpanded && log.context && (
                  <div className="border-t border-gray-300 px-6 py-4 bg-white bg-opacity-50">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
