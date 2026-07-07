# Home Learning Web App

A LAN-first home learning web app for two child profiles. The app runs on a home computer and is meant to be opened from iPad Safari on the same Wi-Fi network.

## Features

- Kid mode with a simple child picker and daily task cards
- Parent mode with password gate, progress dashboard, weak-skill summary, and difficulty controls
- Separate profiles and assignment history for `K` and `Grade 1`
- Local JSON persistence and local audio recording storage

## Run

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open `http://127.0.0.1:3000` on the home computer. The home page now shows:

- The computer name
- The local check URL
- The LAN URLs your iPad can use on the same Wi-Fi

4. From the iPad, open one of the LAN URLs shown on the home page, for example:

```text
http://YOUR_COMPUTER_IP:3000
```

If you need microphone recording on iPad Safari, use HTTPS. The app will automatically show HTTPS LAN links when these files exist:

```text
certs/lan-server.pfx
```

The easiest Windows setup path in this repo is:

```bash
npm run setup:https
```

That script creates:

- `certs/lan-server.pfx` for the local Node server
- `certs/lan-root.cer` to install and trust on the iPad
- `certs/README.txt` with the generated HTTPS LAN URLs

After installing the root certificate on the iPad, Apple says you must manually enable trust in `Settings > General > About > Certificate Trust Settings`. See [Apple Support](https://support.apple.com/en-us/102390).

5. On the iPad home page, use `Device Check` to confirm:

- The page can still reach the local server
- The browser supports touch and recording APIs
- `Secure context` is `Yes` when you open the HTTPS LAN link
- Session storage works
- The microphone permission state is visible when the browser exposes it
- `Start mic test` and `Stop mic test` can capture a short local clip and play it back on the iPad

The default parent password is `2468`.
