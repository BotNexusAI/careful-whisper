# Changelog

## v1.0.0 - Realtime Local Dictation

Initial v1 release notes for the realtime dictation branch.

### Features

- Added realtime Whisper transcription in the Tauri app.
- Added live realtime chunk insertion into the focused app when Auto-paste is enabled.
- Added direct macOS Unicode typing into the target app instead of clipboard paste.
- Added live transcript text in the recording overlay.
- Added a draggable overlay bubble with wrapped multi-line transcript text that grows downward.
- Added Settings Start/Stop recording with delayed target capture after Settings hides.
- Added Settings autosave and removed the manual Save button.
- Added realtime controls and status badges in Settings and the recording bubble.
- Added a realtime POC workspace with scripts, read-aloud samples, and tracking docs.
- Improved tray behavior: left-click opens Settings, secondary-click opens the app menu.

### Fixes

- Skipped final batch transcription after realtime output already exists.
- Preserved final transcription fallback for very short realtime recordings.
- Fixed overlay positioning on external monitors.
- Improved overlay visibility across workspaces and macOS fullscreen Spaces.
- Fixed Hebrew/Unicode log preview crashes from slicing multibyte text.
- Made hotkey re-registration safer so invalid autosaved hotkeys do not break the existing shortcut.
- Improved dev build stability by disabling incremental compilation for the optimized dev profile.
