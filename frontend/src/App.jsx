import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Settings, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ExternalLink,
  Loader2,
  Trash2,
  RefreshCw,
  ChevronRight,
  LayoutDashboard,
  Code,
  Zap
} from 'lucide-react';

const API_BASE = '/api';

function App() {
  const [step, setStep] = useState(1);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [jsonSpec, setJsonSpec] = useState('');
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Connection form
  const [connForm, setConnForm] = useState({
    name: 'default',
    url: '',
    username: '',
    password: ''
  });
  const [showConnForm, setShowConnForm] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadDatabases();
      loadCollections();
    }
  }, [selectedConnection]);

  const loadConnections = async () => {
    try {
      const res = await fetch(`${API_BASE}/connections`);
      const data = await res.json();
      setConnections(data);
      if (data.length > 0 && !selectedConnection) {
        setSelectedConnection(data[0].name);
      }
    } catch (e) {
      console.error('Error loading connections:', e);
    }
  };

  const loadDatabases = async () => {
    try {
      const res = await fetch(`${API_BASE}/connections/${selectedConnection}/databases`);
      const data = await res.json();
      setDatabases(data.data || data || []);
    } catch (e) {
      console.error('Error loading databases:', e);
    }
  };

  const loadCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/connections/${selectedConnection}/collections`);
      const data = await res.json();
      setCollections(data || []);
    } catch (e) {
      console.error('Error loading collections:', e);
    }
  };

  const saveConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connForm)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Connection failed');
      }
      await loadConnections();
      setSelectedConnection(connForm.name);
      setShowConnForm(false);
      setConnForm({ name: 'default', url: '', username: '', password: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteConnection = async (name) => {
    if (!confirm(`Delete connection "${name}"?`)) return;
    try {
      await fetch(`${API_BASE}/connections/${name}`, { method: 'DELETE' });
      await loadConnections();
      if (selectedConnection === name) {
        setSelectedConnection(null);
      }
    } catch (e) {
      console.error('Error deleting connection:', e);
    }
  };

  const validateJson = async () => {
    setLoading(true);
    setError(null);
    setValidation(null);
    try {
      const spec = JSON.parse(jsonSpec);
      const res = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec)
      });
      const data = await res.json();
      setValidation(data);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Invalid JSON: ' + e.message);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const createDashboard = async () => {
    if (!selectedDatabase) {
      setError('Please select a database');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const spec = JSON.parse(jsonSpec);
      const res = await fetch(`${API_BASE}/create-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec,
          connection_name: selectedConnection,
          database_id: selectedDatabase,
          collection_id: selectedCollection
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create dashboard');
      }
      const data = await res.json();
      setResult(data);
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[
        { num: 1, label: 'Connect', icon: Database },
        { num: 2, label: 'Configure', icon: Settings },
        { num: 3, label: 'Create', icon: Play },
        { num: 4, label: 'Done', icon: CheckCircle }
      ].map((s, i) => (
        <React.Fragment key={s.num}>
          <div 
            className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all ${
              step === s.num 
                ? 'bg-blue-600 text-white' 
                : step > s.num 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-slate-100 text-slate-400'
            }`}
            onClick={() => s.num < step && setStep(s.num)}
          >
            <s.icon size={18} />
            <span className="font-medium">{s.label}</span>
          </div>
          {i < 3 && (
            <ChevronRight className="mx-2 text-slate-300" size={20} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Metabase Creator</h1>
              <p className="text-sm text-slate-500">JSON to Dashboard in seconds</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <StepIndicator />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <XCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Connection */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="text-blue-600" size={20} />
              Metabase Connection
            </h2>

            {connections.length > 0 && !showConnForm && (
              <div className="space-y-3 mb-6">
                {connections.map(conn => (
                  <div 
                    key={conn.name}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedConnection === conn.name 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedConnection(conn.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{conn.name}</p>
                        <p className="text-sm text-slate-500">{conn.url}</p>
                        <p className="text-xs text-slate-400">{conn.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {conn.is_connected && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Connected
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConnection(conn.name); }}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(showConnForm || connections.length === 0) && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Connection Name</label>
                  <input
                    type="text"
                    value={connForm.name}
                    onChange={e => setConnForm({...connForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="default"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Metabase URL</label>
                  <input
                    type="text"
                    value={connForm.url}
                    onChange={e => setConnForm({...connForm, url: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="http://localhost:3000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username/Email</label>
                    <input
                      type="text"
                      value={connForm.username}
                      onChange={e => setConnForm({...connForm, username: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={connForm.password}
                      onChange={e => setConnForm({...connForm, password: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveConnection}
                    disabled={loading || !connForm.url || !connForm.username || !connForm.password}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading && <Loader2 className="animate-spin" size={16} />}
                    Save Connection
                  </button>
                  {connections.length > 0 && (
                    <button
                      onClick={() => setShowConnForm(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {!showConnForm && connections.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConnForm(true)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  + Add New Connection
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedConnection}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: JSON Spec */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Code className="text-blue-600" size={20} />
              Dashboard Specification
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Database</label>
                <select
                  value={selectedDatabase || ''}
                  onChange={e => setSelectedDatabase(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select database...</option>
                  {databases.map(db => (
                    <option key={db.id} value={db.id}>{db.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Collection (optional)</label>
                <select
                  value={selectedCollection || ''}
                  onChange={e => setSelectedCollection(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Root collection</option>
                  {collections.filter(c => c.id !== 'root').map(col => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Paste your JSON specification
              </label>
              <textarea
                value={jsonSpec}
                onChange={e => { setJsonSpec(e.target.value); setValidation(null); }}
                className="w-full h-96 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder='{"meta": {"title": "My Dashboard"}, "sections": [...], "queries": {...}}'
              />
            </div>

            {validation && (
              <div className={`mb-4 p-4 rounded-lg ${validation.valid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {validation.valid ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : (
                    <AlertTriangle className="text-yellow-500" size={20} />
                  )}
                  <span className="font-medium">
                    {validation.valid ? 'Valid specification' : 'Validation issues found'}
                  </span>
                </div>
                
                {validation.summary && (
                  <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                    <div className="bg-white/50 rounded p-2">
                      <p className="text-slate-500">Title</p>
                      <p className="font-medium">{validation.summary.title}</p>
                    </div>
                    <div className="bg-white/50 rounded p-2">
                      <p className="text-slate-500">Sections</p>
                      <p className="font-medium">{validation.summary.sections_count}</p>
                    </div>
                    <div className="bg-white/50 rounded p-2">
                      <p className="text-slate-500">Components</p>
                      <p className="font-medium">{validation.summary.components_count}</p>
                    </div>
                    <div className="bg-white/50 rounded p-2">
                      <p className="text-slate-500">Queries</p>
                      <p className="font-medium">{validation.summary.queries_count}</p>
                    </div>
                  </div>
                )}

                {validation.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-700">Errors:</p>
                    <ul className="list-disc list-inside text-sm text-red-600">
                      {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-yellow-700">Warnings:</p>
                    <ul className="list-disc list-inside text-sm text-yellow-600">
                      {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ← Back
              </button>
              <button
                onClick={validateJson}
                disabled={loading || !jsonSpec}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="animate-spin" size={16} />}
                <RefreshCw size={16} />
                Validate
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!jsonSpec || !selectedDatabase}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Create */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="text-blue-600" size={20} />
              Ready to Create
            </h2>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Connection</p>
                  <p className="font-medium">{selectedConnection}</p>
                </div>
                <div>
                  <p className="text-slate-500">Database</p>
                  <p className="font-medium">{databases.find(d => d.id === selectedDatabase)?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Collection</p>
                  <p className="font-medium">{selectedCollection ? collections.find(c => c.id === selectedCollection)?.name : 'Root'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Dashboard</p>
                  <p className="font-medium">{validation?.summary?.title || 'Untitled'}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ← Back
              </button>
              <button
                onClick={createDashboard}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Create Dashboard
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && result && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Dashboard Created!</h2>
            <p className="text-slate-600 mb-6">{result.message}</p>
            
            <a
              href={result.dashboard_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
            >
              <ExternalLink size={20} />
              Open in Metabase
            </a>

            <div className="mt-8">
              <button
                onClick={() => {
                  setStep(2);
                  setJsonSpec('');
                  setValidation(null);
                  setResult(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Create Another Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
