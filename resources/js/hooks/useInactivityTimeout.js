import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

/**
 * Signs an administrative user out after ten minutes of doing nothing.
 *
 * Mounted once, by AdminLayout. Farmer pages use no layout at all and public
 * pages use PublicFormShell, so nothing outside the admin section can reach
 * this — the scoping is structural rather than a role check that could drift.
 *
 * Three decisions worth knowing about:
 *
 * 1. IT DOES NOT USE setTimeout FOR THE DEADLINE. A timer armed for nine
 *    minutes is wrong the moment the laptop lid closes: background tabs get
 *    throttled and sleeping machines stop firing timers altogether, so the
 *    warning would arrive late or never. Instead one cheap interval compares
 *    the clock against a stored timestamp, which is correct however long the
 *    machine was away and whatever the browser did to our timers.
 *
 * 2. THE TIMESTAMP LIVES IN localStorage. That is what makes several tabs
 *    behave as one session: typing in a second tab keeps the first alive,
 *    because both read the same number. No tab polls another and no heartbeat
 *    is sent just to ask "are you still there".
 *
 * 3. THE SERVER IS THE REAL GUARD. Everything here is courtesy — the warning,
 *    the countdown, the tidy sign-out. EnforceAdminIdleTimeout enforces the
 *    same ten minutes on every admin request, so turning JavaScript off
 *    removes the warning and nothing else.
 */

/** Shared across tabs. Plain numbers, so a corrupt value simply reads as 0. */
const ACTIVITY_KEY = 'geofarm:last-activity';
const KEEPALIVE_KEY = 'geofarm:last-keepalive';

/** Page locks are recorded per key by usePageLock. */
const LOCK_PREFIX = 'geofarm:page-lock:';

const MINUTE = 60 * 1000;

/** How often the clock is checked. Cheap: one comparison, no work when idle. */
const TICK_MS = 1000;

/**
 * Activity is written at most this often.
 *
 * mousemove fires hundreds of times a second. Writing to localStorage on each
 * one would be the most expensive thing on the page, so the value is only
 * refreshed once a second — a resolution far finer than a nine-minute warning
 * needs.
 */
const WRITE_THROTTLE_MS = 1000;

/**
 * At most one keep-alive request per this long, ACROSS ALL TABS.
 *
 * The server stamps activity on every ordinary request, so someone clicking
 * around the app never needs this. It exists for the person reading a long
 * report without navigating: without it the server would time them out while
 * they were plainly still working. Four minutes keeps a ten-minute window
 * alive with two requests to spare, and the throttle is shared through
 * localStorage so ten open tabs still send one request between them.
 */
const KEEPALIVE_EVERY_MS = 4 * MINUTE;

const now = () => Date.now();

const readNumber = (key) => {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeNumber = (key, value) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private mode, or storage disabled. The hook still works from the
    // in-memory ref below; it just stops being shared between tabs.
  }
};

/** Is any screen in this tab deliberately locked by usePageLock? */
const anyPageLocked = () => {
  try {
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(LOCK_PREFIX) && window.sessionStorage.getItem(key) === '1') {
        return true;
      }
    }
  } catch {
    // Unreadable storage means we cannot prove a lock is held, and the safe
    // default is the ordinary timeout rather than an immortal session.
  }
  return false;
};

/** The events that count as "still here". Passive: none of them are cancelled. */
const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'click', 'keydown',
  'scroll', 'touchstart', 'pointerdown', 'wheel',
];

export function useInactivityTimeout({
  enabled = true,
  warnAfterMs = 9 * MINUTE,
  logoutAfterMs = 10 * MINUTE,
} = {}) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lockedOpen, setLockedOpen] = useState(false);

  /*
   * A local copy of the shared timestamp.
   *
   * localStorage is the cross-tab channel, but it can be unavailable, and
   * reading it on every mousemove would be wasteful anyway. This ref is the
   * authority within the tab; the stored value wins only when it is NEWER,
   * which is how another tab's activity reaches this one.
   */
  const lastActivityRef = useRef(now());
  const lastWriteRef = useRef(0);

  /*
   * One logout, ever.
   *
   * Without this the interval would fire a second POST a second later, and a
   * manual logout happening at the same moment would race with it. Once set,
   * nothing in this hook touches the network again.
   */
  const loggingOutRef = useRef(false);

  const markActivity = useCallback((shared = true) => {
    const at = now();
    lastActivityRef.current = at;

    if (shared && at - lastWriteRef.current >= WRITE_THROTTLE_MS) {
      lastWriteRef.current = at;
      writeNumber(ACTIVITY_KEY, at);
    }
  }, []);

  /** Push the deadline out and close the warning. Used by "Continue Session". */
  const extend = useCallback(() => {
    if (loggingOutRef.current) return;

    const at = now();
    lastActivityRef.current = at;
    lastWriteRef.current = at;
    writeNumber(ACTIVITY_KEY, at);

    setWarning(false);
    setLockedOpen(false);

    /*
     * Tell the server too, and bypass the usual throttle.
     *
     * Pressing Continue is a promise that the session stays alive. If the
     * server's own window were left to expire because a throttle said "too
     * soon", the next click would land on the login page anyway and the
     * button would have lied.
     */
    writeNumber(KEEPALIVE_KEY, at);
    router.post('/admin/session/keep-alive', {}, {
      preserveState: true,
      preserveScroll: true,
      only: [],
    });
  }, []);

  const signOut = useCallback((reason) => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;

    setWarning(false);
    setLockedOpen(false);

    /*
     * The application's own logout, not a second one.
     *
     * LoginController::destroy already clears active_session_id, invalidates
     * the session, rotates the CSRF token and calls Inertia::clearHistory().
     * Posting here reuses all of it, so an automatic sign-out leaves exactly
     * the state a manual one does.
     */
    router.post('/logout', { reason }, { replace: true });
  }, []);

  /*
   * Listeners. Registered once and never rebuilt — markActivity is stable and
   * writes through a ref, so no state change can cause a re-subscribe. That is
   * what keeps mousemove off React's render path entirely.
   */
  useEffect(() => {
    if (!enabled) return undefined;

    const onActivity = () => markActivity(true);

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }

    // Inertia navigation counts, and it is the one kind of activity that can
    // happen without any of the events above (a redirect after a form post).
    const stopNavigate = router.on('navigate', () => markActivity(true));

    /*
     * A tab coming back to the foreground is not activity by itself — the
     * user may have been away for an hour — but it IS the moment to re-read
     * what other tabs have been doing, so the check below uses a fresh value.
     */
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const shared = readNumber(ACTIVITY_KEY);
        if (shared > lastActivityRef.current) lastActivityRef.current = shared;
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    /*
     * Another tab reporting activity. `storage` fires only in OTHER tabs,
     * which is precisely what is wanted: this is how a second window keeps
     * the first one signed in.
     */
    const onStorage = (event) => {
      if (event.key !== ACTIVITY_KEY) return;
      const shared = Number(event.newValue);
      if (Number.isFinite(shared) && shared > lastActivityRef.current) {
        lastActivityRef.current = shared;
        setWarning(false);
        setLockedOpen(false);
      }
    };
    window.addEventListener('storage', onStorage);

    /*
     * A manual sign-out must silence this hook before the request leaves, or
     * the interval could post a second /logout into the same moment.
     */
    const stopBefore = router.on('before', (event) => {
      const url = String(event.detail?.visit?.url ?? '');
      if (url.includes('/logout')) loggingOutRef.current = true;
    });

    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
      stopNavigate();
      stopBefore();
    };
  }, [enabled, markActivity]);

  /* The clock. One interval, comparing timestamps — see note 1 at the top. */
  useEffect(() => {
    if (!enabled) return undefined;

    markActivity(true);

    const id = setInterval(() => {
      if (loggingOutRef.current) return;

      const shared = readNumber(ACTIVITY_KEY);
      if (shared > lastActivityRef.current) lastActivityRef.current = shared;

      const idle = now() - lastActivityRef.current;

      /*
       * Keep the server's window open while the user is demonstrably here.
       *
       * Only when there has been recent activity: a machine left alone must
       * be allowed to time out, and a heartbeat that fires regardless would
       * keep a deserted session alive for ever. The throttle is stored, so
       * every tab shares one four-minute budget.
       */
      if (idle < KEEPALIVE_EVERY_MS && now() - readNumber(KEEPALIVE_KEY) >= KEEPALIVE_EVERY_MS) {
        writeNumber(KEEPALIVE_KEY, now());
        router.post('/admin/session/keep-alive', {}, {
          preserveState: true,
          preserveScroll: true,
          only: [],
        });
      }

      if (idle < warnAfterMs) {
        setWarning(false);
        setLockedOpen(false);
        return;
      }

      /*
       * Past the warning line. A locked page is told, but never signed out.
       *
       * usePageLock exists because hand-outs happen at a counter with farmers
       * queued, and a clerk counting sacks is not idle in any sense that
       * matters — they are simply not touching the keyboard. Throwing them out
       * mid-distribution would be worse than the stale session it prevents.
       * The server honours the same rule through the keep-alive below.
       */
      const locked = anyPageLocked();

      setWarning(true);
      setLockedOpen(locked);
      setSecondsLeft(Math.max(0, Math.ceil((logoutAfterMs - idle) / 1000)));

      if (locked) {
        // Hold the server's window open too, or the courtesy here would be
        // undone by a 419 on the clerk's next keystroke.
        if (now() - readNumber(KEEPALIVE_KEY) >= KEEPALIVE_EVERY_MS) {
          writeNumber(KEEPALIVE_KEY, now());
          router.post('/admin/session/keep-alive', {}, {
            preserveState: true, preserveScroll: true, only: [],
          });
        }
        return;
      }

      if (idle >= logoutAfterMs) signOut('inactivity');
    }, TICK_MS);

    return () => clearInterval(id);
  }, [enabled, warnAfterMs, logoutAfterMs, markActivity, signOut]);

  return {
    /** Show the dialog? */
    warning,
    /** Seconds until sign-out, for the countdown. */
    secondsLeft,
    /** True when a page lock is holding the session open. */
    lockedOpen,
    /** "Continue Session". */
    extend,
    /** "Log Out". */
    signOut: useCallback(() => signOut('manual'), [signOut]),
  };
}

export default useInactivityTimeout;
