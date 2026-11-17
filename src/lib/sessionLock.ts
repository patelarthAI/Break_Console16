'use client';

import { onBroadcast, sendBroadcast } from './realtime';
import { getSingleUserStatus, getLogs, updateTimeLog, getAllUsers } from './store';
import { getTodayKey, getPastDaysZoned } from './timeUtils';

const DEVICE_ID_KEY = 'bp_workstation_device_id';
const ACTIVE_SESSION_KEY = 'bp_active_device_session';

export interface WorkstationLockResult {
  isLocked: boolean;
  status?: string;
  stationCode?: string;
  reason?: string;
  isPendingTransfer?: boolean;
  targetDeviceId?: string;
}

export interface DeskTransferRequest {
  userId: string;
  userName: string;
  clientName: string;
  targetDeviceId: string;
  originalDeviceId?: string;
  stationCode: string;
  logId: string;
  requestedAt: number;
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
    
    // If no active punch in or lock was explicitly released by Captain (addedBy is null or manual_released)
    if (!activePunchIn || !activePunchIn.addedBy) {
      return { isLocked: false };
    }

    // Check if there is an active transfer request in progress
    if (activePunchIn.addedBy.startsWith('transfer_pending:')) {
      const parts = activePunchIn.addedBy.replace('transfer_pending:', '').split('|from:');
      const targetDev = parts[0];
      const isTarget = targetDev === myDeviceId;
      const stationCode = targetDev.replace('dev_', '').slice(0, 8).toUpperCase();
      return {
        isLocked: true,
        isPendingTransfer: isTarget,
        targetDeviceId: targetDev,
        status: statusRecord.status,
        stationCode,
        reason: isTarget
          ? 'Desk transfer request sent to Captain. Awaiting authorization.'
          : `Active shift in progress on another workstation (Status: ${statusRecord.status.replace('_', ' ').toUpperCase()}).`,
      };
    }

    if (!activePunchIn.addedBy.startsWith('device:')) {
      return { isLocked: false };
    }

    const boundDeviceId = activePunchIn.addedBy.replace('device:', '');
    if (boundDeviceId === myDeviceId) {
      // Device matches the one recorded on punch_in
      return { isLocked: false };
    }
    const stationCode = boundDeviceId.replace('dev_', '').slice(0, 8).toUpperCase();

    // Hard block!
    return {
      isLocked: true,
      isPendingTransfer: false,
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
 * Recruiter requests a desk transfer from their blocked login screen.
 * Tags the active punch_in record with transfer_pending:<myDeviceId>|from:<oldDeviceId>
 * and broadcasts DESK_TRANSFER_REQUEST to Captain console in realtime.
 */
export async function requestWorkstationTransfer(
  userId: string,
  userName?: string,
  clientName?: string
): Promise<{ success: boolean; targetDeviceId: string; error?: string }> {
  if (typeof window === 'undefined') return { success: false, targetDeviceId: '', error: 'Window undefined' };
  const targetDeviceId = getOrCreateDeviceId();

  try {
    const today = getTodayKey();
    let logs = await getLogs(userId, today);
    if (!logs.some(l => l.eventType === 'punch_in')) {
      const yesterday = getPastDaysZoned(1, true)[0];
      if (yesterday) {
        const yLogs = await getLogs(userId, yesterday);
        logs = [...yLogs, ...logs];
      }
    }
    const punchIns = logs.filter(l => l.eventType === 'punch_in');
    const activePunchIn = punchIns[punchIns.length - 1];

    if (!activePunchIn) {
      return { success: false, targetDeviceId, error: 'No active shift found' };
    }

    let originalDev = '';
    if (activePunchIn.addedBy?.startsWith('device:')) {
      originalDev = activePunchIn.addedBy.replace('device:', '');
    } else if (activePunchIn.addedBy?.startsWith('transfer_pending:')) {
      const parts = activePunchIn.addedBy.replace('transfer_pending:', '').split('|from:');
      originalDev = parts[1] || parts[0];
    }

    // Persist request in the active punch_in record (0 new DB rows, 0 storage growth)
    await updateTimeLog(activePunchIn.id, {
      addedBy: `transfer_pending:${targetDeviceId}|from:${originalDev}`,
    });

    // Broadcast instant notification to active Captain consoles
    await sendBroadcast('DESK_TRANSFER_REQUEST', {
      userId,
      userName: userName || 'Recruiter',
      clientName: clientName || '',
      targetDeviceId,
      originalDeviceId: originalDev,
      logId: activePunchIn.id,
      requestedAt: Date.now(),
    });

    return { success: true, targetDeviceId };
  } catch (err: any) {
    console.error('Failed to request workstation transfer:', err);
    return { success: false, targetDeviceId, error: err?.message || 'Request failed' };
  }
}

/**
 * Captain approves a pending desk transfer.
 * Rebinds the punch_in lock to targetDeviceId and broadcasts DESK_TRANSFER_APPROVED.
 */
export async function approveWorkstationTransfer(
  userId: string,
  targetDeviceId: string
): Promise<boolean> {
  try {
    const today = getTodayKey();
    let logs = await getLogs(userId, today);
    if (!logs.some(l => l.eventType === 'punch_in')) {
      const yesterday = getPastDaysZoned(1, true)[0];
      if (yesterday) {
        const yLogs = await getLogs(userId, yesterday);
        logs = [...yLogs, ...logs];
      }
    }
    const punchIns = logs.filter(l => l.eventType === 'punch_in');
    const activePunchIn = punchIns[punchIns.length - 1];

    if (activePunchIn) {
      await updateTimeLog(activePunchIn.id, {
        addedBy: 'device:' + targetDeviceId,
      });
    }

    // Broadcast instant approval so recruiter's screen logs in automatically
    await sendBroadcast('DESK_TRANSFER_APPROVED', {
      userId,
      targetDeviceId,
      approvedAt: Date.now(),
    });

    return true;
  } catch (err) {
    console.error('Failed to approve desk transfer:', err);
    return false;
  }
}

/**
 * Captain declines a pending desk transfer.
 * Reverts the punch_in lock back to the original workstation device.
 */
export async function rejectWorkstationTransfer(userId: string): Promise<boolean> {
  try {
    const today = getTodayKey();
    let logs = await getLogs(userId, today);
    if (!logs.some(l => l.eventType === 'punch_in')) {
      const yesterday = getPastDaysZoned(1, true)[0];
      if (yesterday) {
        const yLogs = await getLogs(userId, yesterday);
        logs = [...yLogs, ...logs];
      }
    }
    const punchIns = logs.filter(l => l.eventType === 'punch_in');
    const activePunchIn = punchIns[punchIns.length - 1];

    if (activePunchIn && activePunchIn.addedBy?.startsWith('transfer_pending:')) {
      const parts = activePunchIn.addedBy.replace('transfer_pending:', '').split('|from:');
      const fallbackDev = parts[1] || parts[0];
      await updateTimeLog(activePunchIn.id, {
        addedBy: 'device:' + fallbackDev,
      });
    }

    await sendBroadcast('DESK_TRANSFER_REJECTED', {
      userId,
      rejectedAt: Date.now(),
    });

    return true;
  } catch (err) {
    console.error('Failed to reject desk transfer:', err);
    return false;
  }
}

/**
 * Recruiter cancels their pending desk transfer request.
 */
export async function cancelWorkstationTransfer(userId: string): Promise<boolean> {
  return rejectWorkstationTransfer(userId);
}

/**
 * Fetches all currently pending desk transfer requests across active shifts today.
 * Used by Captain console on mount and reload.
 */
export async function getPendingDeskTransfers(): Promise<DeskTransferRequest[]> {
  try {
    const today = getTodayKey();
    const users = await getAllUsers();
    const pending: DeskTransferRequest[] = [];

    await Promise.all(
      users.filter(u => !u.isMaster).map(async (u) => {
        try {
          let logs = await getLogs(u.id, today);
          if (!logs.some(l => l.eventType === 'punch_in')) {
            const yesterday = getPastDaysZoned(1, true)[0];
            if (yesterday) {
              const yLogs = await getLogs(u.id, yesterday);
              logs = [...yLogs, ...logs];
            }
          }
          const punchIns = logs.filter(l => l.eventType === 'punch_in');
          const activePunchIn = punchIns[punchIns.length - 1];
          if (activePunchIn && activePunchIn.addedBy?.startsWith('transfer_pending:')) {
            const parts = activePunchIn.addedBy.replace('transfer_pending:', '').split('|from:');
            const targetDev = parts[0];
            const originalDev = parts[1];
            pending.push({
              userId: u.id,
              userName: u.name,
              clientName: u.clientName,
              targetDeviceId: targetDev,
              originalDeviceId: originalDev,
              stationCode: targetDev.replace('dev_', '').slice(0, 8).toUpperCase(),
              logId: activePunchIn.id,
              requestedAt: activePunchIn.timestamp,
            });
          }
        } catch {}
      })
    );

    return pending;
  } catch (err) {
    console.error('Failed to fetch pending desk transfers:', err);
    return [];
  }
}

/**
 * In-person direct transfer (used when Captain is physically standing at recruiter's desk
 * and enters the Master PIN in a private masked field).
 */
export async function transferWorkstationLock(userId: string, targetDeviceId?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const newDeviceId = targetDeviceId || getOrCreateDeviceId();
  return approveWorkstationTransfer(userId, newDeviceId);
}

/**
 * Releases the workstation device lock for a user completely,
 * allowing them to log in from any computer on their next login.
 */
export async function releaseWorkstationLockForUser(userId: string): Promise<boolean> {
  try {
    const today = getTodayKey();
    let logs = await getLogs(userId, today);
    if (!logs.some(l => l.eventType === 'punch_in')) {
      const yesterday = getPastDaysZoned(1, true)[0];
      if (yesterday) {
        const yLogs = await getLogs(userId, yesterday);
        logs = [...yLogs, ...logs];
      }
    }
    const punchIns = logs.filter(l => l.eventType === 'punch_in');
    const activePunchIn = punchIns[punchIns.length - 1];
    if (activePunchIn) {
      await updateTimeLog(activePunchIn.id, {
        addedBy: 'manual_released',
      });
    }
    return true;
  } catch (err) {
    console.error('Failed to release workstation lock for user:', err);
    return false;
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

/**
 * Subscribes to Realtime broadcast events for Captain console
 * to receive live desk transfer requests from recruiters.
 */
export function listenForDeskTransferRequests(
  onRequest: (req: DeskTransferRequest) => void,
  onResolved: (userId: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const unsubReq = onBroadcast('DESK_TRANSFER_REQUEST', (payload: any) => {
    if (!payload || !payload.userId) return;
    onRequest({
      userId: payload.userId,
      userName: payload.userName || 'Recruiter',
      clientName: payload.clientName || '',
      targetDeviceId: payload.targetDeviceId || '',
      originalDeviceId: payload.originalDeviceId || '',
      stationCode: (payload.targetDeviceId || '').replace('dev_', '').slice(0, 8).toUpperCase(),
      logId: payload.logId || '',
      requestedAt: payload.requestedAt || Date.now(),
    });
  });

  const unsubApp = onBroadcast('DESK_TRANSFER_APPROVED', (payload: any) => {
    if (payload?.userId) onResolved(payload.userId);
  });

  const unsubRej = onBroadcast('DESK_TRANSFER_REJECTED', (payload: any) => {
    if (payload?.userId) onResolved(payload.userId);
  });

  return () => {
    unsubReq();
    unsubApp();
    unsubRej();
  };
}

/**
 * Subscribes to Realtime broadcast events for recruiter waiting on desk transfer.
 */
export function listenForDeskTransferApproval(
  userId: string,
  myDeviceId: string,
  onApproved: () => void,
  onRejected: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const unsubApp = onBroadcast('DESK_TRANSFER_APPROVED', (payload: any) => {
    if (payload?.userId === userId && payload?.targetDeviceId === myDeviceId) {
      onApproved();
    }
  });

  const unsubRej = onBroadcast('DESK_TRANSFER_REJECTED', (payload: any) => {
    if (payload?.userId === userId) {
      onRejected();
    }
  });

  return () => {
    unsubApp();
    unsubRej();
  };
}


export function formatStationCode(deviceId?: string): string {
  if (!deviceId) return 'DESK-01';
  const clean = deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return clean || 'DESK-01';
}
