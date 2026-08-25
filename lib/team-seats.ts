export function occupiedWorkspaceSeats(activeMembers: number, pendingInvites: number) {
  return Math.max(0, activeMembers) + Math.max(0, pendingInvites);
}

export function canReserveWorkspaceSeat(activeMembers: number, pendingInvites: number, seatLimit: number) {
  return occupiedWorkspaceSeats(activeMembers, pendingInvites) < seatLimit;
}
