'use client';

/**
 * Leaves the page after changing state the server gates on.
 *
 * Sign-in, sign-up, password reset, onboarding and accepting an invite all
 * change something a redirect on the server reads: the session cookie for the
 * first three, `onboardedAt` for the fourth, membership for the last. The
 * obvious `router.replace(next)` followed by `router.refresh()` does not
 * survive that, and the failure is silent: `refresh()` refetches the route the
 * user is still on and settles the router back onto it, cancelling the replace
 * that had not committed yet. You get the success toast and stay put.
 *
 * A real navigation re-runs middleware and the layouts against the new state,
 * which is the whole point of the refresh, so this replaces both calls rather
 * than working around one of them.
 */
export function hardNavigate(to: string) {
  window.location.assign(to);
}
