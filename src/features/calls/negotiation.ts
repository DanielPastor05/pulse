/**
 * Role assignment for WebRTC perfect negotiation.
 *
 * Kept free of imports on purpose: it is the one piece of call logic that can
 * be tested without a browser, and dragging in the ICE config would drag in
 * environment access with it.
 */

/**
 * Decides which side yields when two offers cross.
 *
 * On a collision the *polite* peer rolls back and accepts the incoming offer;
 * the impolite one ignores it and presses on with its own. Exactly one of the
 * two must be polite — if both yield nobody connects, and if neither does both
 * abort with `InvalidStateError` and the call dies with no visible cause.
 *
 * The decision is derived from the two user ids because both ends must reach
 * the same answer *without talking to each other*, which is precisely the
 * situation during a collision. Any total order works; string comparison of
 * UUIDs is one.
 */
export function isPolite(myId: string, theirId: string): boolean {
  return myId < theirId;
}
