'use client';

import { onBroadcast, sendBroadcast } from './realtime';

const DEVICE_ID_KEY = 'bp_workstation_device_id';
const ACTIVE_SESSION_KEY = 'bp_active_device_session';

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
export function claimWorkstationSession(userId: string, userName?: string): void {
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
  void sendBroadcast('SESSION_CLAIMED', {
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
