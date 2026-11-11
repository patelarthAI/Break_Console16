export interface PolicyRule {
    breakLimitMins: number;
    brbLimitMins: number;
    combinedLimitMins: number;
    graceMins: number;
    shiftStart?: string;
    shiftEnd?: string;
}

export interface PolicyConfigState {
    global: PolicyRule;
    clients: Record<string, Partial<PolicyRule>>;
}

export const DEFAULT_POLICY_RULE: PolicyRule = {
    breakLimitMins: 75,
    brbLimitMins: 10,
    combinedLimitMins: 85,
    graceMins: 5,
};

export const DEFAULT_POLICY_CONFIG: PolicyConfigState = {
    global: { ...DEFAULT_POLICY_RULE },
    clients: {},
};

const STORAGE_KEY = 'brigade_policy_rules_v1';

export function loadPolicyConfig(): PolicyConfigState {
    if (typeof window === 'undefined') return DEFAULT_POLICY_CONFIG;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_POLICY_CONFIG;
        const parsed = JSON.parse(raw) as Partial<PolicyConfigState>;
        return {
            global: { ...DEFAULT_POLICY_RULE, ...(parsed.global ?? {}) },
            clients: parsed.clients ?? {},
        };
    } catch {
        return DEFAULT_POLICY_CONFIG;
    }
}

export function savePolicyConfig(config: PolicyConfigState): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.warn('Failed to persist policy rules:', e);
    }
}

export interface ResolvedPolicy {
    breakLimitMs: number;
    brbLimitMs: number;
    combinedLimitMs: number;
    graceMins: number;
    shiftStart: string;
    shiftEnd: string;
}

export function resolvePolicyForUser(
    config: PolicyConfigState,
    clientName: string,
    userShiftStart = '08:00',
    userShiftEnd = '17:00',
): ResolvedPolicy {
    const override = config.clients[clientName] ?? {};
    const breakLimitMins = Math.max(1, override.breakLimitMins ?? config.global.breakLimitMins);
    const brbLimitMins = Math.max(1, override.brbLimitMins ?? config.global.brbLimitMins);
    const combinedLimitMins = Math.max(1, override.combinedLimitMins ?? config.global.combinedLimitMins);
    const graceMins = Math.max(0, override.graceMins ?? config.global.graceMins);

    return {
        breakLimitMs: breakLimitMins * 60 * 1000,
        brbLimitMs: brbLimitMins * 60 * 1000,
        combinedLimitMs: combinedLimitMins * 60 * 1000,
        graceMins,
        shiftStart: override.shiftStart || userShiftStart || '08:00',
        shiftEnd: override.shiftEnd || userShiftEnd || '17:00',
    };
}
