// Pure paging plan behind `useOrgMemberDirectory`.

/** Offsets of the pages after the first (offset 0, assumed fetched) needed to cover `total` members up to `maxMembers`. */
export function additionalMemberPageOffsets(
  total: number,
  pageSize: number,
  maxMembers: number,
): number[] {
  const cappedTotal = Math.min(total, maxMembers);
  const offsets: number[] = [];
  for (let offset = pageSize; offset < cappedTotal; offset += pageSize) {
    offsets.push(offset);
  }
  return offsets;
}

/** Whether the resolved directory is missing members because `total` exceeds `maxMembers`. */
export function isMemberDirectoryIncomplete(total: number, maxMembers: number): boolean {
  return total > maxMembers;
}
