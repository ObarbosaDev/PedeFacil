const AUTH_RATE_KEYS = {
  signIn: "pedefacil.auth.signin",
  reset: "pedefacil.auth.reset",
};

type RateState = {
  count: number;
  blockedUntil: number;
  windowStartedAt: number;
};

function nowMs() {
  return Date.now();
}

function readState(key: string): RateState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { count: 0, blockedUntil: 0, windowStartedAt: nowMs() };
    }
    const parsed = JSON.parse(raw) as RateState;
    return {
      count: Number(parsed.count || 0),
      blockedUntil: Number(parsed.blockedUntil || 0),
      windowStartedAt: Number(parsed.windowStartedAt || nowMs()),
    };
  } catch {
    return { count: 0, blockedUntil: 0, windowStartedAt: nowMs() };
  }
}

function writeState(key: string, state: RateState) {
  localStorage.setItem(key, JSON.stringify(state));
}

function resetIfWindowExpired(state: RateState, windowMs: number): RateState {
  if (nowMs() - state.windowStartedAt > windowMs) {
    return { count: 0, blockedUntil: 0, windowStartedAt: nowMs() };
  }
  return state;
}

function evaluateBlock(key: string): number {
  const state = readState(key);
  if (state.blockedUntil > nowMs()) {
    return Math.ceil((state.blockedUntil - nowMs()) / 1000);
  }
  return 0;
}

function registerFailure(key: string, maxAttempts: number, windowMs: number, baseBlockMs: number) {
  let state = resetIfWindowExpired(readState(key), windowMs);
  state.count += 1;

  if (state.count >= maxAttempts) {
    const multiplier = Math.max(1, Math.floor((state.count - maxAttempts) / 2) + 1);
    state.blockedUntil = nowMs() + baseBlockMs * multiplier;
  }

  writeState(key, state);
}

function registerSuccess(key: string) {
  writeState(key, { count: 0, blockedUntil: 0, windowStartedAt: nowMs() });
}

export function getSignInBlockSeconds() {
  return evaluateBlock(AUTH_RATE_KEYS.signIn);
}

export function registerSignInFailure() {
  registerFailure(AUTH_RATE_KEYS.signIn, 5, 10 * 60 * 1000, 30 * 1000);
}

export function registerSignInSuccess() {
  registerSuccess(AUTH_RATE_KEYS.signIn);
}

export function getResetBlockSeconds() {
  return evaluateBlock(AUTH_RATE_KEYS.reset);
}

export function registerResetFailure() {
  registerFailure(AUTH_RATE_KEYS.reset, 3, 15 * 60 * 1000, 60 * 1000);
}

export function registerResetSuccess() {
  registerSuccess(AUTH_RATE_KEYS.reset);
}
