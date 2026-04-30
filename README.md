# CampusConnect — Mobile App Setup

A React Native (Expo) demo app for the CampusConnect campus event tracker.
Covers the core student flow: Browse Events → View Details → RSVP → QR Ticket.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Expo Go](https://expo.dev/go) installed on your phone (SDK 54)
- Both your phone and computer on the **same Wi-Fi network**

---

## Running the App

```bash
cd mobile
npm install
npm start
```

A QR code will appear in the terminal. Scan it with:
- **iPhone** — the default Camera app
- **Android** — the Expo Go app

The app will open in Expo Go on your phone.

### Web browser (no phone needed)

After `npm start`, press **`w`** in the terminal to open the app in your browser instead.

---

## SDK Version Notes

The app targets **Expo SDK 54** to match the version of Expo Go available on the App Store / Play Store at the time of development. If you get an incompatibility error when scanning the QR code, check that your Expo Go version matches.

| Thing | Version |
|---|---|
| Expo SDK | ~54.0.0 |
| Expo Go (phone) | 54.x |
| Node.js | 18+ |

### If you see a version mismatch error

**"Project is incompatible with this version of Expo Go"** — your phone's Expo Go is a different SDK than the project. Fix with one of:

1. Update Expo Go from the App Store/Play Store and re-run `npx expo install --fix`
2. Downgrade to match your Expo Go: `npm install expo@~54.0.0` then `npx expo install --fix`

**Peer dependency errors during `npm install`** — run with the legacy flag:
```bash
npm install --legacy-peer-deps
```

---

## Project Structure

```
mobile/
├── App.js                  # Navigation setup (bottom tabs + stacks)
├── app.json                # Expo config
├── package.json
├── assets/
│   └── images/             # Placeholder icons (required by Expo)
└── src/
    ├── theme.js            # Colors shared across all screens
    ├── context/
    │   └── AppContext.js   # Global state (RSVPs, notifications)
    ├── data/
    │   └── mockData.js     # Mock events, notifications, user
    ├── components/
    │   └── EventCard.js    # Reusable event card (full + compact)
    └── screens/
        ├── HomeScreen.js           # Browse & search events, AI picks
        ├── EventDetailScreen.js    # Event info + RSVP button
        ├── MyTicketScreen.js       # QR ticket + scanner simulation
        ├── NotificationsScreen.js  # Notification feed
        └── ProfileScreen.js        # User profile + my RSVPs
```

---

## Demo Flow

1. **Events tab** — browse all events, filter by category, search by keyword
2. Tap an event card → **Event Detail** — see info, capacity bar, RSVP
3. Tap **RSVP for Free** — confirms and adds a notification
4. Tap **View My Ticket** → **QR Ticket screen** — shows a generated QR code and a simulated org-leader scanner view
5. **Notifications tab** — shows RSVP confirmation with an unread badge
6. **Profile tab** — lists your RSVPs; tap the QR icon to jump to a ticket; tap ✕ to cancel
