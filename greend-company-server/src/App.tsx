import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { LayoutDashboard, Database, Settings, LogOut, ChevronLeft, ChevronRight, Users, KeyRound } from 'lucide-react';
import { cn } from './lib/utils';
import Dashboard from './dashboard/Dashboard';
import DataCenter from './data_center/DataCenter';
import SettingsPage from './shared/Settings';
import LoginScreen from './shared/LoginScreen';
import UserManagement from './shared/UserManagement';
import ChangePasswordModal from './shared/ChangePasswordModal';

function AppContent() {
  const { theme, user, logout, loading } = useApp();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-950">
        <span className="text-gray-400 text-sm">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    const titles: Record<string, string> = { dashboard: 'Dashboard', data: 'Data Center' };
    document.title = titles[activeTab] ?? 'GreenD';
  }, [activeTab]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'data', label: 'Data Center', icon: Database },
    // { id: 'compliance', label: 'Compliance', icon: ShieldCheck },  // DISABLED — re-enable when Compliance section is ready
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'data': return <DataCenter />;
      // case 'compliance': return <Compliance />;  // DISABLED — re-enable when Compliance section is ready
      default: return null;
    }
  };

  const getThemeClasses = () => {
    return 'bg-gray-50 text-gray-900';
  };

  const getSidebarClasses = () => {
    return 'bg-gray-900 text-white';
  };

  const getActiveTabClasses = () => {
    return 'bg-gray-800 text-gray-100';
  };

  return (
    <div
      className={cn("flex h-screen w-full overflow-hidden", getThemeClasses())}
      style={{ fontFamily: theme.font }}
    >
      {/* Sidebar */}
      <aside className={cn("flex flex-col transition-all duration-300 relative", getSidebarClasses(), isSidebarMinimized ? "w-20" : "w-64")}>
        <div className={cn("p-6 flex items-center", isSidebarMinimized ? "justify-center px-4" : "justify-between")}>
          {!isSidebarMinimized ? (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">GreenD</h1>
              <p className="text-sm opacity-70 mt-1">Corporate ESG Data Dashboard</p>
            </div>
          ) : (
            <h1 className="text-xl font-bold tracking-tight" title="ESG Nexus">ESG</h1>
          )}
          <button
            onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
            className="absolute -right-3 top-8 bg-gray-800 rounded-full p-1 border border-gray-700 hover:bg-gray-700 z-10 text-white"
          >
            {isSidebarMinimized ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center py-3 rounded-lg transition-all",
                isSidebarMinimized ? "justify-center px-0" : "space-x-3 px-4",
                activeTab === item.id
                  ? getActiveTabClasses()
                  : "hover:bg-white/10 opacity-70 hover:opacity-100"
              )}
              title={isSidebarMinimized ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!isSidebarMinimized && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex flex-col space-y-4 relative">
            {!isSidebarMinimized ? (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-white/10 transition-all text-left w-full"
              >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold shrink-0 uppercase">
                  {user.name.charAt(0)}
                </div>
                <div className="text-sm font-semibold truncate flex-1">
                  {user.name}
                </div>
              </button>
            ) : (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex justify-center w-full py-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold uppercase" title={user.name}>
                  {user.name.charAt(0)}
                </div>
              </button>
            )}

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className={cn(
                  "absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-4 z-50",
                  isSidebarMinimized ? "left-14 w-64" : "left-0 w-full"
                )}>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold shrink-0 uppercase">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white">{user.name}</p>
                      <p className="text-sm text-gray-400 capitalize">{user.role}</p>
                      <p className="text-xs text-gray-500">{user.department}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 pt-3 space-y-1">
                    {user.role === 'admin' && (
                      <button
                        onClick={() => { setIsUserMenuOpen(false); setIsUserMgmtOpen(true); }}
                        className="w-full flex items-center space-x-2 text-sm text-gray-300 hover:text-white transition-colors px-2 py-1.5 rounded hover:bg-white/5"
                      >
                        <Users className="w-4 h-4" />
                        <span>Manage Users</span>
                      </button>
                    )}
                    <button
                      onClick={() => { setIsUserMenuOpen(false); setIsChangePasswordOpen(true); }}
                      className="w-full flex items-center space-x-2 text-sm text-gray-300 hover:text-white transition-colors px-2 py-1.5 rounded hover:bg-white/5"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Change Password</span>
                    </button>
                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-2 text-sm text-red-400 hover:text-red-300 transition-colors px-2 py-1.5 rounded hover:bg-white/5"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={cn(
                "w-full flex items-center py-2 rounded-lg transition-all",
                isSidebarMinimized ? "justify-center px-0" : "space-x-3 px-2",
                "hover:bg-white/10 opacity-70 hover:opacity-100"
              )}
              title={isSidebarMinimized ? 'Settings' : undefined}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!isSidebarMinimized && <span className="font-medium">Settings</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-white/50">
        {renderContent()}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && <SettingsPage onClose={() => setIsSettingsOpen(false)} />}

      {/* User Management Modal */}
      {isUserMgmtOpen && (
        <UserManagement
          currentUser={user}
          onClose={() => setIsUserMgmtOpen(false)}
        />
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
