'use client';

import { useDeferredValue, useEffect, useState, type CSSProperties } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { LeaveRecord, User } from '@/types';
import {
  get7DayBreakStats,
  getAllUsersStatus,
  getLeaves,
  type UserBreakStats,
  type UserStatusRecord,
} from '@/lib/store';
import { getTodayKey } from '@/lib/timeUtils';
import ReimaginedAdminExperience from '@/components/ReimaginedAdminExperience';
import styles from './BrigadeAdminDashboard.module.css';

type DashboardView = 'dashboard' | 'reports' | 'leave' | 'settings';
type StatFilter = 'all' | 'working' | 'on_break' | 'on_brb' | 'on_leave' | 'logged_out' | 'offline';
type MemberStatus = Exclude<StatFilter, 'all'>;

interface Props {
  user: User;
  onLogout: () => void;
}

interface DashboardMember {
  id: string;
  name: string;
  clientName: string;
  shiftStart: string;
  shiftEnd: string;
  status: MemberStatus;
  workedMs: number;
  punchIn?: number;
  latestTouch?: number;
  trackedPercent: number;
  avatarColor: string;
}

const NAV_LINKS: Array<{ id: DashboardView; label: string }> = [
  { id: 'dashboard', label: 'Live Dashboard' },
  { id: 'reports', label: 'Data Reports' },
  { id: 'leave', label: 'Leave Tracker' },
  { id: 'settings', label: 'Settings' },
];

const STAT_CARDS: Array<{ id: StatFilter; label: string; accent: string; valueColor: string }> = [
  { id: 'all', label: 'ALL', accent: 'var(--text-bright)', valueColor: 'var(--text-bright)' },
  { id: 'working', label: 'WORKING', accent: 'var(--green)', valueColor: 'var(--green)' },
  { id: 'on_break', label: 'ON BREAK', accent: 'var(--amber)', valueColor: 'var(--amber)' },
  { id: 'on_brb', label: 'BRB', accent: 'var(--orange)', valueColor: 'var(--orange)' },
  { id: 'on_leave', label: 'ON LEAVE', accent: 'var(--purple)', valueColor: 'var(--purple)' },
  { id: 'logged_out', label: 'LOGGED OUT', accent: 'var(--blue)', valueColor: 'var(--blue)' },
  { id: 'offline', label: 'OFFLINE', accent: 'var(--gray-status)', valueColor: 'var(--gray-status)' },
];

const AVATAR_COLORS = [
  '#5b4fcf',
  '#2d7fc1',
  '#c0392b',
  '#16a085',
  '#d35400',
  '#27ae60',
  '#8e44ad',
  '#e74c3c',
  '#1a5276',
  '#6c3483',
];

const CALENDAR_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const BREAK_LIMIT_PER_DAY = '1h 25m / day';

export default function BrigadeAdminDashboard({ user, onLogout }: Props) {
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [activeFilter, setActiveFilter] = useState<StatFilter>('all');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [statusRecords, setStatusRecords] = useState<UserStatusRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [breakStats, setBreakStats] = useState<UserBreakStats[]>([]);
  const [loading, setLoading] = useState(true);

  const deferredSearch = useDeferredValue(search);
  const todayKey = getTodayKey();
  const todayDateLabel = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: user.timezone,
  }).format(new Date());

  useEffect(() => {
    let cancelled = false;

    if (activeView !== 'dashboard') {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadDashboard() {
      setLoading(true);
      try {
        const [nextStatuses, nextLeaves, nextBreakStats] = await Promise.all([
          getAllUsersStatus(),
          getLeaves(),
          get7DayBreakStats(),
        ]);

        if (cancelled) return;

        setStatusRecords(nextStatuses);
        setLeaveRecords(nextLeaves);
        setBreakStats(nextBreakStats);
      } catch {
        if (cancelled) return;
        setStatusRecords([]);
        setLeaveRecords([]);
        setBreakStats([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView]);

  const todayLeaveKeys = new Set(
    leaveRecords
      .filter((leave) => leave.date === todayKey)
      .map((leave) => toPersonKey(leave.employee_name, leave.client_name)),
  );

  const roster = statusRecords.map((record) => toDashboardMember(record, todayLeaveKeys));
  const statCounts = buildStatCounts(roster);
  const clientOptions = ['all', ...Array.from(new Set(roster.map((member) => member.clientName))).sort((left, right) => left.localeCompare(right))];
  const filteredRoster = roster
    .filter((member) => (clientFilter === 'all' ? true : member.clientName === clientFilter))
    .filter((member) => (activeFilter === 'all' ? true : member.status === activeFilter))
    .filter((member) => {
      const query = deferredSearch.trim().toLowerCase();
      if (!query) return true;
      return member.name.toLowerCase().includes(query) || member.clientName.toLowerCase().includes(query);
    })
    .sort((left, right) => {
      const statusOrder: Record<MemberStatus, number> = {
        working: 0,
        on_break: 1,
        on_brb: 2,
        on_leave: 3,
        logged_out: 4,
        offline: 5,
      };

      return statusOrder[left.status] - statusOrder[right.status] || left.name.localeCompare(right.name);
    });

  const groupedRoster = groupByClient(filteredRoster);
  const monthCells = buildCalendarCells(calendarMonth);
  const leaveDotMap = new Set(leaveRecords.map((leave) => leave.date));
  const todayLeaveCount = Array.from(todayLeaveKeys).length;
  const hallOfFameRows = breakStats
    .filter((row) => row.daysChecked > 0)
    .sort((left, right) => {
      const leftScore = left.avgBreakMs + left.avgBrbMs;
      const rightScore = right.avgBreakMs + right.avgBrbMs;
      return leftScore - rightScore || right.daysChecked - left.daysChecked;
    })
    .slice(0, 3);
  const isMonday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: user.timezone }).format(new Date()) === 'Monday';
  const showRaceEmptyState = isMonday || hallOfFameRows.length === 0;
  const breakViolators = breakStats
    .filter((row) => row.daysChecked >= 1 && row.avgBreakMs + row.avgBrbMs > 85 * 60 * 1000)
    .sort((left, right) => (right.avgBreakMs + right.avgBrbMs) - (left.avgBreakMs + left.avgBrbMs))
    .slice(0, 4);
  const adminView = activeView === 'leave' ? 'leave' : activeView;

  return (
    <div className={styles.root}>
      <div className={styles.hairline} />

      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.navLeft}>
            <div className={styles.logoBox}>BP</div>
            <div className={styles.brandName}>Brigade Pulse</div>
            <div className={styles.adminPill}>ADMIN</div>
            <div className={styles.liveCluster}>
              <span className={styles.liveDot} />
              <span className={styles.liveText}>LIVE</span>
            </div>
          </div>

          <div className={styles.navCenter}>
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveView(link.id)}
                className={link.id === activeView ? styles.navLinkActive : styles.navLink}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className={styles.navRight}>
            <div className={styles.navDate}>{todayDateLabel}</div>
            <button type="button" onClick={onLogout} className={styles.signOut}>
              Sign out <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
      </nav>

      <div className={styles.page}>
        <div className={styles.statsGrid}>
          {STAT_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveFilter(card.id)}
              aria-pressed={activeFilter === card.id}
              className={activeFilter === card.id ? styles.statCardActive : styles.statCard}
              style={
                {
                  '--card-accent': card.accent,
                  '--card-value': card.valueColor,
                } as CSSProperties
              }
            >
              <div className={styles.statNumber}>{statCounts[card.id]}</div>
              <div className={styles.statLabel}>{card.label}</div>
            </button>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.leftColumn}>
            {activeView === 'dashboard' ? (
              <>
                <div className={styles.filterBar}>
                  <div className={styles.liveFilter}>
                    <span className={styles.liveDot} />
                    <span className={styles.liveText}>LIVE</span>
                  </div>

                  <label className={styles.searchWrap}>
                    <Search size={14} strokeWidth={1.8} className={styles.searchIcon} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search recruiter or client..."
                      className={styles.searchInput}
                    />
                  </label>

                  <div className={styles.selectWrap}>
                    <div className={styles.selectPill}>
                      <SlidersHorizontal size={13} strokeWidth={1.8} />
                      <span>{clientFilter === 'all' ? 'All Clients' : clientFilter}</span>
                      <ChevronDown size={13} strokeWidth={1.8} />
                    </div>
                    <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className={styles.selectInput} aria-label="Filter by client">
                      {clientOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all' ? 'All Clients' : option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.matches}>{filteredRoster.length} matches</div>
                </div>

                {loading ? (
                  <div className={styles.emptyPanel}>Loading live workforce data.</div>
                ) : groupedRoster.length === 0 ? (
                  <div className={styles.emptyPanel}>No recruiters match the current filters.</div>
                ) : (
                  groupedRoster.map(([clientName, members]) => {
                    const offlineCount = members.filter((member) => member.status === 'offline').length;

                    return (
                      <section key={clientName} className={styles.sectionGroup}>
                        <div className={styles.sectionHeader}>
                          <div className={styles.sectionTitle}>{clientName}</div>
                          <div className={styles.sectionPill}>{members.length} REPS</div>
                          <div className={styles.sectionPill}>{offlineCount} OFFLINE</div>
                          <div className={styles.sectionRule} />
                        </div>

                        <div className={styles.rows}>
                          {members.map((member) => (
                            <div key={member.id} className={styles.employeeRow}>
                              <div className={styles.avatar} style={{ backgroundColor: member.avatarColor }}>
                                {member.name.charAt(0).toUpperCase()}
                              </div>

                              <div className={styles.employeeInfo}>
                                <div className={styles.employeeName}>{member.name}</div>
                                <div className={styles.employeeMeta}>
                                  <span>{member.clientName}</span>
                                  <span className={styles.metaDot} />
                                  <span className={styles.shiftMono}>{member.shiftStart} - {member.shiftEnd}</span>
                                </div>
                              </div>

                              <div className={statusBadgeClassName(member.status, styles)}>{statusLabel(member.status)}</div>

                              <div className={styles.trackInfo}>
                                <div className={styles.trackTime}>{formatStamp(member.latestTouch)}</div>
                                <div className={styles.trackPercent}>{member.trackedPercent}% tracked</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })
                )}
              </>
            ) : activeView === 'reports' ? (
              <section className={styles.tabPanel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>Data Reports</div>
                  <div className={styles.panelMeta}>Live workforce totals</div>
                </div>
                <div className={styles.reportList}>
                  {Object.entries(statCounts)
                    .filter(([key]) => key !== 'all')
                    .map(([key, value]) => (
                      <div key={key} className={styles.reportRow}>
                        <span>{statusLabel(key as MemberStatus)}</span>
                        <span className={styles.monoValue}>{value}</span>
                      </div>
                    ))}
                </div>
              </section>
            ) : activeView === 'leave' ? (
              <section className={styles.tabPanel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>Leave Tracker</div>
                  <div className={styles.panelMeta}>{todayLeaveCount} active today</div>
                </div>
                <div className={styles.leaveList}>
                  {leaveRecords.slice(0, 12).map((leave) => (
                    <div key={leave.id} className={styles.leaveRow}>
                      <div>
                        <div className={styles.leaveName}>{leave.employee_name}</div>
                        <div className={styles.leaveMeta}>{leave.client_name} - {leave.leave_type}</div>
                      </div>
                      <div className={styles.monoValue}>{leave.date}</div>
                    </div>
                  ))}
                  {leaveRecords.length === 0 && <div className={styles.emptyPanel}>No leave records available.</div>}
                </div>
              </section>
            ) : (
              <section className={styles.tabPanel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>Settings</div>
                  <div className={styles.panelMeta}>{clientOptions.length - 1} clients tracked</div>
                </div>
                <div className={styles.reportList}>
                  {clientOptions
                    .filter((option) => option !== 'all')
                    .map((clientName) => (
                      <div key={clientName} className={styles.reportRow}>
                        <span>{clientName}</span>
                        <span className={styles.monoValue}>
                          {roster.filter((member) => member.clientName === clientName).length}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>

          <aside className={styles.sidebar}>
            <section className={styles.widget}>
              <div className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>Leave Console</div>
                <div className={todayLeaveCount === 0 ? styles.badgeSuccess : styles.badgeNeutral}>
                  {todayLeaveCount === 0 ? 'All Clear' : `${todayLeaveCount} Today`}
                </div>
              </div>

              <div className={styles.widgetBody}>
                <div className={styles.calendarTop}>
                  <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} className={styles.calendarButton} aria-label="Previous month">
                    <ChevronLeft size={14} />
                  </button>
                  <div className={styles.calendarMonth}>{formatMonthLabel(calendarMonth)}</div>
                  <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} className={styles.calendarButton} aria-label="Next month">
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className={styles.calendarHeader}>
                  {CALENDAR_HEADERS.map((label) => (
                    <div key={label} className={styles.calendarHeadCell}>
                      {label}
                    </div>
                  ))}
                </div>

                <div className={styles.calendarGrid}>
                  {monthCells.map((cell) => {
                    const isToday = cell.key === todayKey;
                    const inMonth = cell.date.getMonth() === calendarMonth.getMonth();
                    const hasLeave = leaveDotMap.has(cell.key);

                    return (
                      <div key={cell.key} className={inMonth ? styles.calendarCell : styles.calendarCellMuted}>
                        <div className={isToday ? styles.calendarToday : styles.calendarDay}>{cell.date.getDate()}</div>
                        {hasLeave && <span className={styles.leaveDotMark} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={`${styles.widget} ${styles.widgetGold}`}>
              <div className={styles.widgetHeader}>
                <div className={`${styles.widgetTitle} ${styles.widgetTitleGold}`}>Elite Hall of Fame</div>
                <div className={styles.badgeGold}>Weekly Race</div>
              </div>

              <div className={styles.widgetBody}>
                {showRaceEmptyState ? (
                  <div className={styles.widgetEmpty}>
                    <div className={styles.widgetEmoji}>🏆</div>
                    <div className={styles.emptyLine}>Rankings reset every Monday.</div>
                    <div className={styles.emptyLine}>First activity claims the top spot.</div>
                    <button type="button" className={styles.goldButton}>Join the Race</button>
                  </div>
                ) : (
                  <div className={styles.hallList}>
                    {hallOfFameRows.map((row, index) => (
                      <div key={row.user.id} className={styles.hallRow}>
                        <span className={styles.hallRank}>#{index + 1}</span>
                        <div className={styles.hallInfo}>
                          <div className={styles.leaveName}>{row.user.name}</div>
                          <div className={styles.leaveMeta}>{row.user.clientName}</div>
                        </div>
                        <div className={styles.monoValue}>{formatMinutes(row.avgBreakMs + row.avgBrbMs)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={`${styles.widget} ${styles.widgetRed}`}>
              <div className={styles.widgetHeader}>
                <div className={`${styles.widgetTitle} ${styles.widgetTitleRed}`}>Break Violators</div>
                <div className={styles.badgeNeutral}>Last 5 Days</div>
              </div>

              <div className={styles.widgetBody}>
                <div className={styles.limitPanel}>
                  <span className={styles.limitLabel}>Break + BRB limit</span>
                  <span className={styles.limitValue}>{BREAK_LIMIT_PER_DAY}</span>
                </div>

                {breakViolators.length === 0 ? (
                  <div className={styles.widgetEmpty}>
                    <div className={styles.successIcon}>✓</div>
                    <div className={styles.successLine}>No violations detected</div>
                    <div className={styles.emptyLine}>The team is crushing it 💪</div>
                  </div>
                ) : (
                  <div className={styles.violatorList}>
                    {breakViolators.map((row) => (
                      <div key={row.user.id} className={styles.violatorRow}>
                        <div className={styles.leaveName}>{row.user.name}</div>
                        <div className={styles.leaveMeta}>{row.user.clientName}</div>
                        <div className={styles.violatorValue}>{formatMinutes(row.avgBreakMs + row.avgBrbMs)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function toDashboardMember(record: UserStatusRecord, todayLeaveKeys: Set<string>): DashboardMember {
  const key = toPersonKey(record.user.name, record.user.clientName);
  const status = toMemberStatus(record, todayLeaveKeys.has(key));
  const latestTouch = record.punchOut ?? record.breakStart ?? record.brbStart ?? record.workStart ?? record.punchIn;
  const trackedPercent = getTrackedPercent(record);

  return {
    id: record.user.id,
    name: record.user.name,
    clientName: record.user.clientName,
    shiftStart: record.user.shiftStart,
    shiftEnd: record.user.shiftEnd,
    status,
    workedMs: record.workedMs,
    punchIn: record.punchIn,
    latestTouch,
    trackedPercent,
    avatarColor: AVATAR_COLORS[Math.abs(hashString(record.user.name)) % AVATAR_COLORS.length],
  };
}

function toMemberStatus(record: UserStatusRecord, onLeave: boolean): MemberStatus {
  if (onLeave) return 'on_leave';
  if (record.status === 'working') return 'working';
  if (record.status === 'on_break') return 'on_break';
  if (record.status === 'on_brb') return 'on_brb';
  if (record.status === 'punched_out') return 'logged_out';
  return 'offline';
}

function getTrackedPercent(record: UserStatusRecord) {
  const shiftMinutes = minutesBetween(record.user.shiftStart, record.user.shiftEnd);
  const shiftMs = Math.max(1, shiftMinutes * 60000);
  return Math.max(0, Math.min(100, Math.round((record.workedMs / shiftMs) * 100)));
}

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return endTotal >= startTotal ? endTotal - startTotal : 24 * 60 - startTotal + endTotal;
}

function buildStatCounts(roster: DashboardMember[]) {
  return {
    all: roster.length,
    working: roster.filter((member) => member.status === 'working').length,
    on_break: roster.filter((member) => member.status === 'on_break').length,
    on_brb: roster.filter((member) => member.status === 'on_brb').length,
    on_leave: roster.filter((member) => member.status === 'on_leave').length,
    logged_out: roster.filter((member) => member.status === 'logged_out').length,
    offline: roster.filter((member) => member.status === 'offline').length,
  };
}

function groupByClient(roster: DashboardMember[]) {
  const groups = new Map<string, DashboardMember[]>();

  for (const member of roster) {
    const current = groups.get(member.clientName) ?? [];
    current.push(member);
    groups.set(member.clientName, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([clientName, members]) => [
      clientName,
      [...members].sort((left, right) => left.name.localeCompare(right.name)),
    ] as const);
}

function statusLabel(status: MemberStatus) {
  switch (status) {
    case 'working':
      return 'WORKING';
    case 'on_break':
      return 'ON BREAK';
    case 'on_brb':
      return 'BRB';
    case 'on_leave':
      return 'ON LEAVE';
    case 'logged_out':
      return 'IDLE';
    default:
      return 'OFFLINE';
  }
}

function statusBadgeClassName(status: MemberStatus, sheet: Record<string, string>) {
  switch (status) {
    case 'working':
      return `${sheet.statusBadge} ${sheet.statusWorking}`;
    case 'on_break':
      return `${sheet.statusBadge} ${sheet.statusBreak}`;
    case 'on_brb':
      return `${sheet.statusBadge} ${sheet.statusBrb}`;
    case 'on_leave':
      return `${sheet.statusBadge} ${sheet.statusLeave}`;
    case 'logged_out':
      return `${sheet.statusBadge} ${sheet.statusIdle}`;
    default:
      return `${sheet.statusBadge} ${sheet.statusOffline}`;
  }
}

function formatStamp(timestamp?: number) {
  if (!timestamp) return '--:--';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function formatMinutes(value: number) {
  const minutes = Math.round(value / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder.toString().padStart(2, '0')}m`;
}

function shiftMonth(value: Date, amount: number) {
  return startOfMonth(new Date(value.getFullYear(), value.getMonth() + amount, 1));
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function buildCalendarCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const nextDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    return {
      date: nextDate,
      key: formatDateKey(nextDate),
    };
  });
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toPersonKey(name: string, clientName: string) {
  return `${name.trim().toLowerCase()}::${clientName.trim().toLowerCase()}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
