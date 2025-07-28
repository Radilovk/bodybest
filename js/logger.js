let debugEnabled = false;

export function enableDebug(flag = true) {
  debugEnabled = !!flag;
}

export function debugLog(...args) {
  if (debugEnabled) {
    console.log(...args);
  }
}
