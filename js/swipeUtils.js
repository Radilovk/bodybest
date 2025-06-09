export function computeSwipeTargetIndex(currentIndex, diffX, threshold, tabCount) {
  if (Math.abs(diffX) < threshold) return currentIndex;
  return diffX < 0 ? (currentIndex + 1) % tabCount : (currentIndex - 1 + tabCount) % tabCount;
}
