# Tablić (Android)

The Serbian fishing card game Tablić with a French 52-card deck, for 2–4 players, with bots.
Built like the Scopa app (`~/claude/scopa`): a Java rules engine and a tiny local web server,
shown in a WebView. The app never contacts the internet.

Languages: Српски (ћирилица), Srpski (latinica), Русский, English, Deutsch.

## Rules implemented

- Values: 2–10 face value, J = 12, Q = 13, K = 14, Ace = 1 or 11 (also on the table).
- 4 cards face up on the table, 6 cards each; redeal 6 each until the deck is used up
  (2 players: 4 deals, 3 players: 6 + 6 + 4, 4 players: 2 deals). Play goes counter-clockwise,
  the player to the dealer's right starts; the deal passes on after each hand.
- A card takes table cards of equal value or groups that add up to its value, several disjoint
  groups at once. Taking is optional.
- Tabla (clearing the table): 1 point, not with the last card of the hand. The last capturer
  takes the cards left on the table.
- Scoring: A, K, Q, J, 10 = 1 each, 10♦ = 2, 2♣ = 1, most cards = 3 (nobody on a tie), tablas.
  25 points per hand plus tablas.
- Lobby options: 2, 3, 4 players as 2×2 partners or 4 each alone; **Short** game (one hand,
  draw possible) or **Long** game (to 101; a tie for the lead plays another hand).

## How to play together

- **One phone (pass-and-play):** set several seats to *This device*; the hand is covered until
  the next player taps it.
- **Browser players:** set a seat to *Remote player*. Others on the same Wi-Fi (or the host
  phone's hotspot) open the address shown in the lobby.
- **Bluetooth (app players, no Wi-Fi needed):** pair the two phones once in Android's
  Bluetooth settings. On the host, set a seat to *Remote player* and tap *Allow Bluetooth*
  (it stays on across restarts until turned off). On the other phone open Tablić, tap
  *Join via Bluetooth* and pick the host phone. Up to ~7 phones can join one host.
  The guest app shows its own copy of the game UI; only the game moves go over Bluetooth.
  Both phones need the same app version.
- **Bots:** easy / normal / hard. The host can hand a seat to a bot from the ☰ menu.

In the game: tap a hand card and the best capture is marked on the table; tap table cards to
change it (or mark them first, then pick the card); tap the card again to play. Hold your pile
to see what you took.

## Build (offline, no Gradle)

Requires JDK 17+ and the Android SDK (`platforms/android-35`, `build-tools/35.0.0`) in `~/Android/Sdk`.

```bash
./build.sh          # -> build/tablic.apk (min Android 7.0 / API 24)
./build.sh test     # rule unit checks + bot-vs-bot games and level duels
./build.sh desktop  # run the same server on this PC (http://localhost:8080) for testing
./build.sh relaytest # Bluetooth relay checks, with TCP standing in for Bluetooth
```

The APK is signed with `~/claude/.keys/cards/tablic.jks`, with its password in `tablic.pass` next to it.
Keys and passwords are never in git. Keep them backed up: Android only installs updates signed
with the same key.

## Generated assets

```bash
node tools/gen_cards.js     # skins/french/*.svg (52 cards + back) and tools/icon/*.svg
tools/make_icon.sh          # icon.png + Android launcher icons (needs rsvg-convert)
node tools/sr_cyrillic.js   # regenerate the Cyrillic strings from the Serbian Latin ones
```

Edit Serbian texts in `sr_lat` in `app/assets/web/i18n.js`, then run `tools/sr_cyrillic.js`.

## Layout

- `app/core/` – pure Java: rules engine (`Game`), bots, room/lobby, tiny HTTP server
- `app/src/` – Android `MainActivity` (WebView locked to the local server) and `Bluetooth`
  (RFCOMM host listener / guest connector)
- `app/core/.../Relay.java` – carries the API calls between guest and host over one stream
- `app/assets/web/` – the game UI (HTML/CSS/JS), shared by the app and remote browsers
- `skins/french/` – card images (copied into the APK by `build.sh`)
- `desktop/` – desktop runner and simulation tests
