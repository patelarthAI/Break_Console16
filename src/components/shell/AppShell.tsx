'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { User } from '@/types';
import Navbar from '@/components/shell/Navbar';
import StatusBar, { type StatusCounts } from '@/components/shell/StatusBar';
import LiveFloor from '@/components/admin/LiveFloor';

// Lazy-load heavy views
const MasterReports = dynamic(() => import('@/components/MasterReports'), {
  loading: () => <div className="skeleton rounded-xl h-96 mx-6" />,
});
const MasterLeaveTracker = dynamic(() => import('@/components/MasterLeaveTracker'), {
  loading: () => <div className="skeleton rounded-xl h-96 mx-6" />,
});
const AdminSettings = dynamic(() => import('@/components/admin/Settings'), {
  loading: () => <div className="skeleton rounded-xl h-96 mx-6" />,
});

interface AppShellProps {
  user: User;
  onLogout: () => void;
}

export default function AppShell({ user, onLogout }: AppShellProps) {
  const [activeView, setActiveView] = useState('dashboard');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    working: 0,
    on_break: 0,
    on_brb: 0,
    on_leave: 0,
    logged_out: 0,
    offline: 0,
  });

  const handleStatusCountsChange = useCallback((counts: StatusCounts) => {
    setStatusCounts(counts);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      <Navbar
        user={user}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={onLogout}
      />

      {/* Status bar only on dashboard */}
      {activeView === 'dashboard' && (
        <StatusBar
          counts={statusCounts}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />
      )}

      {/* Views */}
      {activeView === 'dashboard' && (
        <LiveFloor
          user={user}
          onStatusCountsChange={handleStatusCountsChange}
          activeFilter={statusFilter}
        />
      )}

      {activeView === 'reports' && (
        <div className="px-4 lg:px-6 pb-6">
          <MasterReports />
        </div>
      )}

      {activeView === 'leave' && (
        <div className="px-4 lg:px-6 pb-6">
          <MasterLeaveTracker currentUser={user} />
        </div>
      )}

      {activeView === 'settings' && (
        <div className="px-4 lg:px-6 pb-6">
          <AdminSettings user={user} />
        </div>
      )}
    </div>
  );
}
