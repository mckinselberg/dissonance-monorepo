// Browsers deliberately block scripts from suppressing their own "close
// tab" shortcut — the keydown preventDefault below is a no-op for Ctrl+W/
// Cmd+W in standard browser tabs, kept only for embedded contexts
// (Electron, webviews) where that block doesn't apply. The beforeunload
// listener is what actually protects players in a real browser tab: it
// triggers the native "leave site?" confirmation on any close attempt
// (Ctrl+W, the tab's close button, or closing the window), regardless of
// which input caused it.
export function preventAccidentalClose(): void {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
  });
}
