# Realtime Whisper Implementation Tracker

Source discussion: `docs/realtime_whisper_discussion.md`

POC entry point: `poc/realtime_mic_poc.py`

## Status

| Phase | Status | Current State | Next Move |
| --- | --- | --- | --- |
| Phase 1 - Standalone POC | Complete enough | Mic capture works with `--device ':1'`; continuous capture produces usable English transcription; the runner prints timing/audio levels and a final transcript. | Keep using it as the baseline while testing latency improvements. |
| Phase 2 - POC hardening | Started | Continuous capture fixed the capture-gap word-loss issue; remaining problems are latency and minor duplicate/substituted words. | Test a persistent-model path or tune chunk size/overlap before app integration. |
| Phase 3 - App prototype | Not started | No Tauri/Rust integration for streaming partial text yet. | Start only after POC behavior is understood. |
| Phase 4 - Stabilized output | Not started | Clipboard/paste remains batch-only. | Design commit semantics after partial text stabilizes. |
| Phase 5 - Productization | Not started | No user-facing realtime mode. | Defer until prototype proves useful. |

## Completed Work

- Created `poc/` as an isolated realtime dictation experiment.
- Cloned `ggerganov/whisper.cpp` into `poc/vendor/whisper.cpp`.
- Built `whisper-cli` locally with Accelerate/Metal support detected by CMake.
- Reused the installed app's verified base model via `poc/models/ggml-base.bin`.
- Added `poc/realtime_mic_poc.py`.
- Added `poc/README.md` with run instructions.
- Verified `whisper-cli` can transcribe a generated speech WAV with the local
  model on CPU.
- Captured first live `--gpu --language he` result: 3-second chunks took about
  6.8-9.3 seconds total and repeatedly emitted `הוא עוד קצת את זה`, which looks
  like hallucination on silence, weak audio, wrong mic, or forced-language
  noise rather than useful Hebrew dictation.
- Updated the POC to print chunk RMS/peak levels and skip very quiet chunks by
  default.
- Captured second live `--gpu --language he --max-chunks 3 --keep-audio` result:
  all chunks had `rms=-inf`, `peak=-inf`, and the saved WAV files contained zero
  nonzero samples. This confirms ffmpeg is currently recording digital silence,
  so microphone permission or device selection must be fixed before judging
  Whisper quality.
- Listed AVFoundation devices from normal Terminal. Audio `:0` is `Virtual
  Desktop Speakers`, audio `:1` is `MacBook Pro Microphone`, and audio `:2` is
  `Virtual Desktop Mic`. The next live mic test should use `--device ':1'`.
- Captured first successful live mic result with `--device ':1' --language he
  --gpu --max-chunks 3 --keep-audio`: speech levels were healthy
  (`rms=-29.3` to `-33.3dBFS`, `peak=-12.2` to `-18.6dBFS`), Hebrew output was
  mixed but real, and total time was 4.4-5.8 seconds per roughly 2.5-2.7 seconds
  of captured audio.
- Updated the POC default device to `:1` and added separate `record=` and
  `whisper=` timing in chunk output.
- Reconfigured `whisper.cpp` with `-DWHISPER_SDL2=ON` and built
  `whisper-stream`.
- Added `poc/run_whisper_stream.sh` as the next lower-latency test command.
- Tested `whisper-stream`: `--capture 1` hallucinated text, while the default
  SDL capture transcribed Hebrew but quality was poor and timings ended around
  57 seconds with many fallbacks. Treat SDL capture ID `1` as suspect.
- Added `poc/test_samples.md` with fixed Hebrew and English paragraphs for
  repeatable quality comparisons.
- Switched POC defaults to English-first: `realtime_mic_poc.py` now defaults to
  `--language en`, and `poc/run_whisper_stream.sh` defaults to `-l en`.
- Captured first English chunked run: transcription quality was usable, but the
  transcript text was visually buried after timing metadata. Also observed that
  ffmpeg recording took 6.1-7.9 seconds to produce about 4.3 seconds of audio,
  while Whisper itself took about 1.1-2.0 seconds.
- Updated `realtime_mic_poc.py` to print clear `TEXT [NNNN]:` lines and a final
  `FULL TRANSCRIPT` block.
- Identified likely cause of dropped words when speaking faster: the old
  sequential runner stopped recording while each chunk was sent to Whisper.
  Words spoken during `whisper=...` time were never captured.
- Added `--capture-mode continuous` as the default. It keeps a single ffmpeg
  process recording in a background reader and queues chunks while Whisper
  transcribes earlier audio. The old behavior remains available with
  `--capture-mode chunked`.
- Captured first continuous English control result. Output was broadly correct:
  "hello, this is a short test..." through "...next stage of the experiment."
  Remaining errors were minor duplicate/substituted words such as duplicated
  "I'm" and "testing" misheard as "just in". This proves the local capture plus
  Whisper path is viable for English, but it still feels slow.

## Next Test

Run from normal Terminal/iTerm:

```sh
python3 poc/realtime_mic_poc.py --list-devices
python3 poc/realtime_mic_poc.py --gpu --chunk-seconds 5 --max-chunks 8 --keep-audio
python3 poc/realtime_mic_poc.py --capture-mode chunked --gpu --chunk-seconds 5 --max-chunks 8 --keep-audio
poc/run_whisper_stream.sh
python3 poc/realtime_mic_poc.py --language he --gpu --chunk-seconds 5 --max-chunks 8 --keep-audio
poc/run_whisper_stream.sh -l he
```

If device `:0` is not the right microphone, use the audio device index reported
by `--list-devices`.

Healthy speech should show RMS clearly above the default `-50dBFS` silence
threshold and `nonzero` above zero. If it does not, fix macOS microphone
permission, device selection, or input gain before tuning Whisper.

## Notes To Preserve

- The installed app already downloaded `ggml-base.bin` and config currently
  uses `active_model: "base"` and `language: "he"`.
- The Codex sandbox did not expose AVFoundation microphone devices, so live mic
  validation must happen outside this sandbox.
- The POC defaults to CPU by passing `-ng`; use `--gpu` to compare Metal.
- Continuous capture is the current best baseline. It reduces dropped words from
  capture gaps, but it still launches `whisper-cli` per chunk, so a persistent
  model path remains the next optimization.
- SDL capture IDs do not match ffmpeg/AVFoundation IDs reliably. Prefer the
  default SDL capture first; only pass `--capture N` after checking the device
  list printed by `whisper-stream`.
