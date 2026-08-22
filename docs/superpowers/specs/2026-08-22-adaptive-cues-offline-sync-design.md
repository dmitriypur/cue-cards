# Cue Cards adaptive cues and offline readiness design

Date: 2026-08-22  
Status: approved for implementation

## Goal

Each script card receives a speaking outline with as many cues as its meaning requires. Server-generated cues are downloaded into the phone's SQLite database and remain available for editing and recording without a network connection.

## Adaptive generation

- The model receives the script title, the ordered outline of active card titles, and the full text of each requested card.
- It returns one compact, complete speaking prompt for every independent idea, in source order, without a numeric target or fixed maximum.
- A valid ready cue set contains at least one unique non-empty string. Each cue remains limited to 200 characters and the existing prompt/snapshot byte safeguards remain active.
- The outline provides continuity only; facts for a card must come exclusively from that card's full text.
- The AI prompt version becomes `2`. Generation stays one-pass and keeps the existing queue retries and usage accounting.

## Offline flow

- An offline generation request remains durable in SQLite and starts automatically after connectivity returns.
- Completion publishes the ordinary versioned script snapshot through `sync_changes`.
- Startup, app resume, connectivity recovery, terminal generation polling, and manual sync all download changes through the existing transactionally applied feed.
- Recording reads only local repositories. No model is embedded in the APK.
- The library reports `Тезисы на устройстве: N из M`; `N` counts only ready cue sets whose source hash matches current card content. Full coverage is labelled `Готово офлайн`.

## Safety

- AI never changes full script text.
- Fresh local text, manual cues, stale results, and genuine version conflicts retain their existing protections.
- PostgreSQL and SQLite schemas already store cue arrays as JSON, so no migration is required.

## Acceptance

- Server and mobile contracts accept one and more than five cues while rejecting empty, duplicate, blank, or overlong entries.
- A server result with more than five cues survives the change feed, SQLite persistence, repository reconstruction, and an offline recording read.
- A production DeepSeek smoke with synthetic Cyrillic content produces more than four meaningful cues for a deliberately rich block and covers its predefined semantic units in source order.

