# OpenBot for Android and e-ink

This branch builds the existing OpenBot mobile app (`apps/mobile`, Expo + React Native) as a
standalone Android APK, with e-ink readers as the primary target and Android 15+ phones and
tablets as a first-class fallback. The app never runs agents itself: it is always a remote
front end for an OpenBot desktop host, which it reaches over the same authenticated WebRTC
connection the iOS app uses.

Porting the Electron/Solid desktop renderer was rejected: the mobile app already implements
the remote protocol, pairing, chat, channels, search and settings, and its Android build is
supported upstream. Work here stays in that app so it keeps merging with upstream.

## Build and install

Requirements: Bun 1.4, Node 24+, JDK 17, Android SDK (platform 36, build-tools 36.0.0,
NDK 27.1.12297006, CMake 3.22.1).

```bash
bun install --frozen-lockfile          # repository root
bun run --cwd apps/mobile android:apk  # writes apps/mobile/dist/openbot-android.apk
adb install -r apps/mobile/dist/openbot-android.apk
```

`ABIS=arm64-v8a,armeabi-v7a` adds 32-bit devices, and `CLEAN=1` regenerates `android/`.
The APK is signed with the prebuild debug keystore, which is enough for sideloading.

The Android package is `run.openbot.eink`, so it installs beside the official app. Expo OTA
updates are disabled: the upstream update channel must not replace this build's JavaScript.

## Pairing

1. On the computer, open OpenBot → Settings → Mobile Connect → Generate QR code.
2. On a device with a camera, scan it. On a camera-less e-ink reader, choose **Copy link**
   under the QR code (desktop built from this branch), send the link to the device, copy it,
   and choose **Paste connect link** on the sign-in screen.

## What this branch changes

| Area | Change |
| --- | --- |
| Theme | New **E-ink** appearance (Settings → General → Appearance): paper white, pure black text, solid black borders, no translucency or shadows. E-ink readers (Onyx Boox, Bigme, Boyue/Likebook, Meebook, Hisense, PocketBook, mooInk) start in it until another theme is chosen. |
| Motion | E-ink forces reduced motion: no route transitions, no Reanimated animations, no word-by-word reply reveal, no animated avatars or blurred scroll edges. |
| Streaming | In e-ink, a streaming reply repaints at most every 1.5 s instead of on every token. |
| Orientation | Portrait and landscape follow the device. Conversations are centred at a 760 dp reading width on wide screens. |
| Pairing | Paste a Mobile Connect link instead of scanning; desktop gains a Copy link button beside the QR code. |
| Build | `android:apk` script, higher Gradle memory limits, separate package id, OTA disabled. |

## Roadmap

Priorities follow the stated use case: e-ink first, Android 15+ second, then feature parity.
Each phase is releasable on its own.

### Phase 1 — Messaging on e-ink (current build, verify on device)

- [x] Standalone APK connecting to a desktop host; agents, chats, channels, search, queued
      messages, question prompts, attachments, voice dictation, settings (inherited).
- [x] E-ink theme, e-ink auto-detection, motion off, throttled streaming.
- [x] Auto portrait/landscape; readable width on tablets.
- [x] Paste-link pairing for camera-less readers.
- [ ] On-device pass on a Boox (Android 12/13) and an Android 15 phone: contrast of every
      screen, native pickers/menus in e-ink, keyboard insets in landscape, edge-to-edge.
- [ ] Replace remaining colour-dependent states (online dot, agent colours, file chips) with
      shape or text cues where they vanish in greyscale.

### Phase 2 — E-ink comfort

- [ ] Onyx EPD refresh control via the Boox SDK: fast (A2) mode while scrolling, one full
      refresh when a reply completes to clear ghosting.
- [ ] Page-wise reading: volume/page-turn keys scroll the conversation by one screen.
- [ ] Text size and bold-text settings independent of the system font scale.
- [ ] Static monochrome agent avatars (initials) instead of the animated Skia avatars.
- [ ] Dithered/greyscale image previews; optional "images on tap".
- [ ] Batch other live updates (activity rows, plans, thinking text) on the same cadence as
      streaming text.

### Phase 3 — Android platform

- [ ] Push notifications for replies and questions (FCM; needs host/account-service support).
- [ ] Android share target: send text, links and files from other apps to an agent.
- [ ] Hardware keyboard: Enter to send, Shift+Enter for newline, shortcuts.
- [ ] Release signing key, versioned APKs on GitHub Releases, CI workflow, in-app update check.

### Phase 4 — Tablets and landscape

- [ ] Two-pane layout at ≥ 600 dp: agent/channel list beside the open chat.
- [ ] Composer width capped with the conversation; sheets as centred dialogs on tablets.

### Phase 5 — Browser

- [ ] Read-only view of an agent's browser tab (periodic screenshots, not video — suits e-ink).
- [ ] Browser takeover: tap and type forwarding, secure sign-in handoff (the mobile app already
      renders browser secret requests).
- Needs host endpoints; the desktop's browser PiP and the web client are the references.

### Phase 6 — Computer control

- [ ] Snapshot view of the host screen with the agent cursor, on demand rather than streamed.
- [ ] Approve/deny computer-use actions from the phone; later, remote input.

### Phase 7 — Remaining desktop parity

- [ ] Routines, skills, hosted sites, shared data tables, file browser, provider sign-in,
      agent templates/marketplace, team and usage views.
