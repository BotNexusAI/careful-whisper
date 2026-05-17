# Upstream PR Notes

Target repository: `YarivGilad/careless-whisper`

These notes are for preparing a clean upstream pull request from the realtime
dictation work. Keep the upstream PR scoped deliberately so it is easy to
review as feature work rather than a product or release reset.

## Recommended Scope

- Include the reusable realtime transcription path, overlay/status UI, settings
  controls, and app-flow fixes.
- Exclude fork-only website copy, release-channel wording, and local planning
  notes unless upstream explicitly wants those changes.
- Treat the `1.0.0` version bump as a maintainer decision. Keep it out of the
  upstream PR if the PR is intended to be feature-only.
- Include the platform support notes from `CHANGELOG.md` in the PR description
  so reviewers know what has been validated and what still needs Windows/Linux
  QA.

## PR Summary Draft

Adds an opt-in realtime dictation mode on top of the existing batch
transcription flow. While recording, the app transcribes short Whisper chunks,
shows partial text in the overlay, and can insert committed chunks into the
captured target when Auto-paste is enabled. Batch transcription remains the
fallback path, and realtime mode skips the duplicate final transcription once
live output has already been produced.

## Platform Support

- Core realtime audio capture, resampling, and Whisper chunk transcription use
  cross-platform Rust/Tauri paths and are intended to build on macOS, Windows,
  and Linux.
- macOS is the validated realtime path for this branch. Live output uses direct
  Unicode keyboard events and requires Accessibility permission.
- Windows and Linux currently keep the clipboard-plus-paste fallback for
  realtime chunks and need dedicated QA before claiming parity with macOS live
  typing.
- Linux paste behavior depends on the desktop session and helper tools
  (`xdotool`, `ydotool`, or `wtype`), so Wayland/X11 behavior should be tested
  per distro/compositor.
- Windows/Linux builds should disable the default Metal feature unless feature
  defaults are changed upstream.

## Suggested Verification

- `corepack pnpm build`
- `cargo check --manifest-path src-tauri/Cargo.toml --no-default-features`
- `cargo check --manifest-path src-tauri/Cargo.toml --no-default-features --features metal`
- Manual macOS test: enable Realtime transcription and Auto-paste, start from a
  focused text field with the global hotkey, confirm overlay partials and live
  cursor insertion.
- Manual Windows/Linux follow-up: validate focus capture, chunk insertion,
  clipboard side effects, tray behavior, and overlay visibility.
