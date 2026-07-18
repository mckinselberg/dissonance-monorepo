// Browsers deliberately block scripts from suppressing their own "close
// tab" shortcut — the keydown preventDefault below is a no-op for Ctrl+W/
// Cmd+W in standard browser tabs, kept only for embedded contexts
// (Electron, webviews) where that block doesn't apply. The beforeunload
// listener is what actually protects players in a real browser tab: it
// triggers the native "leave site?" confirmation on any close attempt
// (Ctrl+W, the tab's close button, or closing the window), regardless of
// which input caused it.
//
// Returns a cleanup so app-owned navigations (Load View, reset-position,
// level switches) can intentionally opt out right before they reload/leave.
export function preventAccidentalClose(): () => void {
  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault();
    }
  };
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
