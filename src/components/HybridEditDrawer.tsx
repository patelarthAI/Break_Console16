'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Clock, 
  Trash2, 
  Plus, 
  AlertCircle, 
  ChevronRight, 
  Coffee, 
  LogIn, 
  LogOut,
  History
} from 'lucide-react';
import { TimeLog, User } from '@/types';
import { getLogs, insertLog, deleteTimeLog, updateTimeLog } from '@/lib/store';
import { formatTime, generateUUID, computeSession } from '@/lib/timeUtils';
import { cn, toTitleCase } from '@/lib/utils';
import TimelineLog from '@/components/TimelineLog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/ui/CustomSelect';

interface HybridEditDrawerProps {
  user: User;
  date: string;
  onClose: () => void;
  onSave: () => void;
  currentUserId: string;
}

export default function HybridEditDrawer({ user, date, onClose, onSave, currentUserId }: HybridEditDrawerProps) {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [logType, setLogType] = useState<TimeLog['eventType']>('punch_in');
  const [logTime, setLogTime] = useState('09:00');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getLogs(user.id, date);
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id, date]);

  const session = useMemo(() => computeSession(logs), [logs]);

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const [h, m] = logTime.split(':').map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(h, m, 0, 0);

    if (editingLogId) {
      await updateTimeLog(editingLogId, {
        eventType: logType,
        timestamp: d.getTime(),
        date
      });
    } else {
      const newLog: TimeLog = {
        id: generateUUID(),
        eventType: logType,
        timestamp: d.getTime(),
        date,
        addedBy: currentUserId
      };
      await insertLog(user.id, newLog);
    }

    const latest = await getLogs(user.id, date);
    setLogs(latest);
    setShowAddForm(false);
    setEditingLogId(null);
    onSave();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteTimeLog(deleteConfirmId);
    setLogs(prev => prev.filter(l => l.id !== deleteConfirmId));
    setDeleteConfirmId(null);
    onSave();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div key="drawer-wrapper" className="fixed inset-0 z-[100] flex justify-end">
        <motion.div 
          key="drawer-overlay"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="fixed inset-0 bg-black/60"
          style={{ backdropFilter: 'blur(10px)' }}
        />
        
        <motion.div 
          key="drawer-panel"
          initial={{ x: '100%' }} 
          animate={{ x: 0 }} 
          exit={{ x: '100%' }} 
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-xl flex flex-col h-full overflow-hidden"
          style={{
            background: 'rgba(12, 12, 16, 0.85)',
            backdropFilter: 'blur(40px) saturate(200%)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '-20px 0 80px rgba(0,0,0,0.8)'
          }}
        >
          {/* Header */}
          <div className="p-8 pb-6 border-b border-white/[0.04] relative overflow-hidden">
            <div style={{
              position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px',
              background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)',
              filter: 'blur(30px)', pointerEvents: 'none'
            }} />
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A855F7', boxShadow: '0 0 10px rgba(168,85,247,0.8)' }} />
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--f-display)' }}>
                  Log Inspector
                </span>
              </div>
              <motion.button onClick={onClose} whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }} whileTap={{ scale: 0.9 }}
                style={{ padding: '8px', borderRadius: '12px', color: 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }}>
                <X size={18} />
              </motion.button>
            </div>
            
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', fontFamily: 'var(--f-display)', marginBottom: '8px', position: 'relative', zIndex: 10 }}>
              {toTitleCase(user.name)}
            </h2>
            
            <div className="flex items-center gap-3 relative z-10">
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--f-mono)' }}>
                {date}
              </span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#00C8FF', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {user.clientName}
              </span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex px-8 border-b border-white/[0.04]" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <button onClick={() => setActiveTab('visual')}
              style={{
                padding: '16px 20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em',
                color: activeTab === 'visual' ? '#fff' : 'rgba(255,255,255,0.4)',
                borderBottom: `2px solid ${activeTab === 'visual' ? '#A855F7' : 'transparent'}`,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}>
              Visualization
              {activeTab === 'visual' && (
                <div style={{ position: 'absolute', bottom: '-2px', left: '20%', right: '20%', height: '2px', background: '#A855F7', boxShadow: '0 -2px 10px rgba(168,85,247,0.8)' }} />
              )}
            </button>
            <button onClick={() => setActiveTab('raw')}
              style={{
                padding: '16px 20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em',
                color: activeTab === 'raw' ? '#fff' : 'rgba(255,255,255,0.4)',
                borderBottom: `2px solid ${activeTab === 'raw' ? '#A855F7' : 'transparent'}`,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}>
              Event List
              {activeTab === 'raw' && (
                <div style={{ position: 'absolute', bottom: '-2px', left: '20%', right: '20%', height: '2px', background: '#A855F7', boxShadow: '0 -2px 10px rgba(168,85,247,0.8)' }} />
              )}
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="h-8 w-8 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" style={{ boxShadow: '0 0 15px rgba(168,85,247,0.5)' }} />
                <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Compiling Timeline...</p>
              </div>
            ) : activeTab === 'visual' ? (
              <div className="space-y-8">
                {/* Visual Strip */}
                <div className="space-y-4">
                  <h3 style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--f-display)' }}>
                    Activity Timeline
                  </h3>
                  <div style={{
                    height: '80px', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.2) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', position: 'relative', overflow: 'hidden',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                  }}>
                     {/* Timeline visual representation could go here */}
                     <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                     
                     <div className="absolute inset-x-0 bottom-2 flex justify-between px-6" style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--f-mono)' }}>
                        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
                     </div>
                  </div>
                </div>

                {/* Session Breakdown Cards */}
                <div className="space-y-4">
                  <h3 style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--f-display)' }}>
                    Session Breakdown
                  </h3>
                  
                  {session.punchIn ? (
                    <div className="flex flex-col gap-3">
                        <SessionCard key="primary-session" type="work" start={formatTime(session.punchIn)} end={session.punchOut ? formatTime(session.punchOut) : 'Active Now'} isLive={!session.punchOut} />
                        {session.breaks.map((b, i) => (
                            <SessionCard key={`break-${i}`} type="break" start={formatTime(b.start)} end={b.end ? formatTime(b.end) : '--:--'} />
                        ))}
                        {session.brbs.map((b, i) => (
                            <SessionCard key={`brb-${i}`} type="brb" start={formatTime(b.start)} end={b.end ? formatTime(b.end) : '--:--'} />
                        ))}
                    </div>
                  ) : (
                    <div style={{
                      borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.01)',
                      padding: '40px', textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                          Null Identity Access
                        </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <TimelineLog 
                logs={logs} 
                isAdmin 
                onEditLog={(log) => {
                    setEditingLogId(log.id);
                    setLogType(log.eventType);
                    const d = new Date(log.timestamp);
                    setLogTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                    setShowAddForm(true);
                }}
                onDeleteLog={setDeleteConfirmId} 
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/[0.04]" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)' }}>
            <AnimatePresence mode="wait">
                {showAddForm ? (
                    <motion.form key="form"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        onSubmit={handleSaveLog} className="space-y-6"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: '4px' }}>Event Type</label>
                                <CustomSelect
                                    options={[
                                        { value: 'punch_in', label: 'Punch In' },
                                        { value: 'punch_out', label: 'Punch Out' },
                                        { value: 'break_start', label: 'Break Start' },
                                        { value: 'break_end', label: 'Break End' },
                                        { value: 'brb_start', label: 'BRB Start' },
                                        { value: 'brb_end', label: 'BRB End' }
                                    ]}
                                    value={logType}
                                    onChange={(val) => setLogType(val as TimeLog['eventType'])}
                                />
                            </div>
                            <div className="space-y-2">
                                <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: '4px' }}>Timestamp</label>
                                <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)}
                                    style={{
                                      width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                                      borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 800, color: '#fff',
                                      outline: 'none', transition: 'border 0.2s', fontFamily: 'var(--f-mono)'
                                    }}
                                    className="focus:border-indigo-500 [color-scheme:dark]" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <motion.button type="submit"
                                whileHover={{ scale: 1.02, backgroundColor: 'rgba(168,85,247,0.9)' }} whileTap={{ scale: 0.98 }}
                                style={{
                                  flex: 1, background: 'linear-gradient(135deg, rgba(168,85,247,0.8) 0%, rgba(139,92,246,0.6) 100%)',
                                  color: '#fff', borderRadius: '12px', padding: '14px 0', fontSize: '11px', fontWeight: 800,
                                  textTransform: 'uppercase', letterSpacing: '0.15em', border: '1px solid rgba(216,180,254,0.3)',
                                  boxShadow: '0 0 20px rgba(168,85,247,0.3), inset 0 1px 1px rgba(255,255,255,0.2)'
                                }}>
                                {editingLogId ? 'Update Identity' : 'Override Identity'}
                            </motion.button>
                            <motion.button type="button" onClick={() => { setShowAddForm(false); setEditingLogId(null); }}
                                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }} whileTap={{ scale: 0.98 }}
                                style={{
                                  padding: '0 24px', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
                                  borderRadius: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em',
                                  background: 'transparent'
                                }}>
                                Cancel
                            </motion.button>
                        </div>
                    </motion.form>
                ) : (
                    <motion.button key="add" onClick={() => setShowAddForm(true)}
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)' }} whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px',
                        padding: '16px 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em',
                        color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                      }}>
                      <Plus size={16} />
                      Inject Manual Event
                    </motion.button>
                )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <ConfirmDialog 
        key="drawer-confirm"
        open={!!deleteConfirmId}
        title="Permanently remove log?"
        message="This action is irreversible and will immediately recalculate productivity metrics for this day."
        confirmLabel="Confirm Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </AnimatePresence>,
    document.body
  );
}

function SessionCard({ type, start, end, isLive }: { type: 'work' | 'break' | 'brb', start: string, end: string, isLive?: boolean }) {
    const labels = {
        work: 'System Identity Active',
        break: 'Maintenance Interruption',
        brb: 'Brief Disconnect',
    };

    const colors = {
        work: '#00E5A0',
        break: '#FFB800',
        brb: '#BF7FFF',
    };

    const accentColor = colors[type];

    return (
        <motion.div 
            whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
            style={{
                position: 'relative', overflow: 'hidden',
                borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(255,255,255,0.02)', padding: '16px',
                transition: 'all 0.2s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}
        >
            {/* Dynamic side accent */}
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                backgroundColor: accentColor,
                boxShadow: `0 0 15px 1px ${accentColor}A0`
            }} />
            
            <div className="flex items-center justify-between gap-4 pl-2">
                <div className="flex flex-col gap-1.5">
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                        {labels[type]}
                    </p>
                    <div className="flex items-center gap-3">
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', fontFamily: 'var(--f-mono)' }}>{start}</span>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
                        <span style={{
                            fontSize: '14px', fontWeight: 800, fontFamily: 'var(--f-mono)',
                            color: isLive ? accentColor : '#fff',
                            textShadow: isLive ? `0 0 10px ${accentColor}80` : 'none'
                        }} className={isLive ? "animate-pulse" : ""}>
                            {end}
                        </span>
                    </div>
                </div>
                
                <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: accentColor,
                    boxShadow: `0 0 10px ${accentColor}80`,
                    opacity: isLive ? 1 : 0.5
                }} />
            </div>
        </motion.div>
    );
}
