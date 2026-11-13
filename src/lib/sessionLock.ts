'use client';

import { onBroadcast, sendBroadcast } from './realtime';
import { getSingleUserStatus, getLogs } from './store';
import { getTodayKey, getPastDaysZoned } from './timeUtils';

const DEVICE_ID_KEY = 'bp_workstation_device_id';
const ACTIVE_SESSION_KEY = 'bp_active_device_session';

export interface WorkstationLockResult {
  isLocked: boolean;
  status?: string;
  stationCode?: string;
  reason?: string;
}

/**
 * Checks if the user is currently on an active shift on a DIFFERENT physical workstation.
 * If active on another workstation, returns isLocked = true to HARD BLOCK the login.
 */
export async function checkWorkstationLock(userId: string): Promise<WorkstationLockResult> {
  if (typeof window === 'undefined') return { isLocked: false };
  const myDeviceId = getOrCreateDeviceId();

  try {
    // 1. Check if user is currently on an active shift (working, on_break, on_brb)
    const statusRecord = await getSingleUserStatus(userId);
    if (!statusRecord) return { isLocked: false };

    const activeStatuses = ['working', 'on_break', 'on_brb'];
    if (!activeStatuses.includes(statusRecord.status)) {
      // User is idle or punched out: no active shift in progress, any workstation can start shift
      return { isLocked: false };
    }

    // 2. Check if THIS browser already holds the active session token for this user
    try {
      const localSessionRaw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (localSessionRaw) {
        const localSession = JSON.parse(localSessionRaw);
        if (localSession.userId === userId && localSession.deviceId === myDeviceId) {
          // This browser IS the authorized workstation!
          return { isLocked: false };
        }
      }
    } catch {}

    // 3. Check logs to see what device started today's active shift
    const today = getTodayKey();
    let logs = await getLogs(userId, today);
    if (!logs.some(l => l.eventType === 'punch_in')) {
      const yesterday = getPastDaysZoned(1, true)[0];
      if (yesterday) {
        const yLogs = await getLogs(userId, yesterday);
        logs = [...yLogs, ...logs];
      }
    }

    const punchInLogs = logs.filter(l => l.eventType === 'punch_in');
    const activePunchIn = punchInLogs[punchInLogs.length - 1];
    let stationCode = 'OTHER-PC';
    if (activePunchIn && activePunchIn.addedBy && activePunchIn.addedBy.startsWith('device:')) {
      const boundDeviceId = activePunchIn.addedBy.replace('device:', '');
      if (boundDeviceId === myDeviceId) {
        // Device matches the one recorded on punch_in
        return { isLocked: false };
      }
      stationCode = boundDeviceId.replace('dev_', '').slice(0, 8).toUpperCase();
    }

    // Hard block!
    return {
      isLocked: true,
      status: statusRecord.status,
      stationCode,
      reason: `Active shift in progress on another workstation (Status: ${statusRecord.status.replace('_', ' ').toUpperCase()}).`,
    };
  } catch (err) {
    console.warn('Failed to verify workstation lock:', err);
    return { isLocked: false };
  }
}

/**
 * Returns a persistent workstation device identifier.
 * Stable across tabs and browser restarts on the same machine.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'fallback_device_' + Date.now();
  }
}

/**
 * Claims the active session for the given user on this workstation.
 * Broadcasts an ephemeral SESSION_CLAIMED event across the shared WebSocket channel
 * to force-terminate any other computer running this user's account.
 * (Zero database writes, zero storage growth).
 */
export async function claimWorkstationSession(userId: string, userName?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const deviceId = getOrCreateDeviceId();
  const sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const sessionData = {
    userId,
    userName,
    deviceId,
    sessionId,
    claimedAt: Date.now(),
  };

  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
  } catch {}

  // Broadcast to all other active browsers in the team
  await sendBroadcast('SESSION_CLAIMED', {
    userId,
    userName,
    deviceId,
    sessionId,
    timestamp: Date.now(),
  });
}

/**
 * Clears the active workstation session on logout.
 */
export function releaseWorkstationSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {}
}

/**
 * Subscribes to Realtime broadcast events to detect if another machine
 * has logged in with the same recruiter account.
 */
export function listenForSessionOverride(
  currentUserId: string,
  onOverride: (info: { time: string; remoteDeviceId: string; remoteUser?: string }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const myDeviceId = getOrCreateDeviceId();

  const unsubBroadcast = onBroadcast('SESSION_CLAIMED', (payload: any) => {
    if (!payload || !payload.userId) return;

    // Same user ID, but different physical workstation / device ID
    if (payload.userId === currentUserId && payload.deviceId && payload.deviceId !== myDeviceId) {
      const timeStr = new Date(payload.timestamp || Date.now()).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const remoteShort = String(payload.deviceId)
        .replace('dev_', '')
        .slice(0, 8)
        .toUpperCase();

      onOverride({
        time: timeStr,
        remoteDeviceId: remoteShort,
        remoteUser: payload.userName,
      });
    }
  });

  return () => {
    unsubBroadcast();
  };
}
