export const trimHeadToMaxPoints = <T>(
  series: T[],
  maxPoints?: number
): number => {
  if (typeof maxPoints !== 'number' || maxPoints <= 0) {
    return 0;
  }

  const overflow = series.length - maxPoints;
  if (overflow > 0) {
    series.splice(0, overflow);
  }

  return Math.max(overflow, 0);
};
