# Realtime Whisper Current Issues

This file tracks open questions and known problems for the realtime dictation
effort. Keep it short and current.

## Open Issues

### App Prototype Needs Live Validation

The Rust/Tauri realtime prototype is wired in, but it has not yet been tested
through the actual app UI with microphone permission, the overlay window, and
the final paste path together.

Next action: run the app, enable **Realtime transcription** in Settings, record
the English control paragraph from `poc/test_samples.md`, and compare overlay
partials with the final batch transcript.

### Continuous Runner Latency Is Still Noticeable

With the correct microphone device (`:1`), continuous capture is good enough to
prove audio/model quality but still feels slow for realtime dictation. The first
continuous English control result was broadly correct, but text still appears
after chunk boundaries rather than truly live.

Mitigation already added: `realtime_mic_poc.py` now defaults to continuous
ffmpeg capture, so recording continues while Whisper transcribes previous
chunks. This reduces dropped words from capture gaps, but it still launches
`whisper-cli` and loads the model for every chunk.

Next action: test the English sample with continuous capture:

```sh
python3 poc/realtime_mic_poc.py --gpu --chunk-seconds 5 --max-chunks 8 --keep-audio
```

Then compare a persistent-model path:

```sh
poc/run_whisper_stream.sh
```

If the default SDL capture is wrong, inspect the capture device list printed at
startup and only then try `poc/run_whisper_stream.sh --capture N`.

### Stream Mode Quality Is Poor So Far

The first stream test with `--capture 1` hallucinated text, which suggests SDL
capture ID `1` is not the same as ffmpeg's AVFoundation `:1`. Running without
`--capture` produced Hebrew output, but it was garbled and repeated phrases like
`תודה רבה`. Timings ended around 57 seconds with many fallbacks, so this is not
yet a usable realtime path.

Next action: use the English sample in `poc/test_samples.md` first as the
control case, then compare Hebrew once the pipeline behavior is understood.

### English Quality Has Minor Chunk Artifacts

The first continuous English result was readable and mostly accurate, but still
included minor artifacts: duplicated "I'm", "testing" misheard as "just in",
and small missing/substituted words. These look like chunk-boundary/context
issues rather than broken capture.

Next action: after latency, test chunk duration and overlap/deduplication.

### Hebrew Quality Is Mixed With Base Model

The first valid mic run produced one good Hebrew chunk:
`אפשר להמשיך לעבוד בצורה כזאתי`, but earlier chunks were garbled. This may be
from short chunks, lack of context/VAD, the base model, or normal Whisper
instability on small audio windows.

Next action: defer Hebrew tuning until English chunked and stream baselines are
understood.

## Resolved / Explained

### Mic Capture Was All-Zero Audio

The second live command:

```sh
python3 poc/realtime_mic_poc.py --device ':0' --language he --gpu --max-chunks 3 --keep-audio
```

produced chunks with `rms=-inf` and `peak=-inf`. Inspecting the saved WAV files
confirmed every sample was zero. This is digital silence, not low-quality
Hebrew transcription.

Confirmed cause:

- `--device ':0'` mapped to `Virtual Desktop Speakers`, not the MacBook mic.
- `--device ':1'` maps to `MacBook Pro Microphone`.

Resolution: use `--device ':1'`, now also the POC default on this machine.

### First Hebrew GPU Run Hallucinated Repeated Text

The first live command:

```sh
python3 poc/realtime_mic_poc.py --device ':0' --language he --gpu
```

returned repeated `הוא עוד קצת את זה` phrases for multiple chunks. That does
not look like usable Hebrew dictation. Later device listing showed `:0` was
`Virtual Desktop Speakers`, so this was Whisper hallucinating on all-zero audio.

Resolution: re-run with `--device ':1'`; the hallucinated phrase was from
recording all-zero audio on `:0`.

### Mic Access In Codex Sandbox

`ffmpeg` did not list AVFoundation audio devices from the Codex sandbox. This
does not mean the POC is broken; it means live mic validation needs to run from
normal Terminal/iTerm with macOS microphone permission.

Next action: run `python3 poc/realtime_mic_poc.py --list-devices` outside Codex.

### Metal/GPU Path Needs A Real Terminal Test

The `whisper.cpp` build detected Metal support, but the first reliable smoke
test used CPU with `-ng`. GPU behavior should be tested from a normal terminal
before assuming realtime latency numbers.

Next action: compare `--gpu` vs default CPU on the same spoken phrase.

### Sequential Chunked Capture Was Creating Gaps

The first POC recorded one complete chunk, transcribed it, printed text, then
recorded the next chunk. That proved local chunked transcription, but it left
gaps while Whisper was running.

Resolution: `realtime_mic_poc.py` now defaults to continuous ffmpeg capture, and
the Rust prototype reads from the active app capture buffer while recording. The
remaining issue is latency, not dropped audio during transcription.

### Duplicate Text Handling Is Unimplemented

Overlapping windows are not active yet, so there is no duplicate-suffix or
stable-prefix logic. This will matter as soon as we add overlap.

Next action: add overlap only after baseline chunk latency is measured.

### Partial Vs Committed Output Is Undesigned

The app now displays realtime partials in the overlay, but realtime dictation
still needs a rule for when text is stable enough to commit to another app.
Replacing already pasted text is brittle across arbitrary desktop apps.

Next action: keep Phase 3 app integration limited to overlay/log partial text.

### VAD Is Deferred

No voice activity detection is included in the POC. Without VAD, Whisper may
process silence and produce unstable or empty chunks.

Next action: evaluate whether chunked output is usable enough before adding VAD.

### App Integration Must Preserve Batch Mode

The current batch path is simple and reliable. Realtime work landed as an
opt-in settings flag and overlay-only partial text, not as a replacement for the
existing stop-then-transcribe behavior.

Resolution: batch mode remains the default fallback, and auto-paste still uses
the final transcript after stop.
