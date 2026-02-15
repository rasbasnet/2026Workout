# Workout Hub

A multi-page workout website with Firebase login, workout tracking, food tracking, daily weight logging, and chart-based analytics.

## Pages

- `login.html` - Firebase email/password auth
- `index.html` - Dashboard (profile + daily weight)
- `routine.html` - Existing routine guide
- `workout-tracker.html` - Track completed workout steps by day + notes
- `food-tracker.html` - Track meals + time + calorie intensity + notes
- `data-chart.html` - Auto-generated charts and trend summary

## Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable `Authentication -> Sign-in method -> Email/Password`.
3. Enable Cloud Firestore in production or test mode.
4. Open `/Users/rasbasnet/Documents/code/2026Workout/js/firebase.js` and replace all `REPLACE_ME` values with your Firebase web app config.
5. Apply Firestore rules from `/Users/rasbasnet/Documents/code/2026Workout/firestore.rules`.

## Data Model

- `users/{uid}/profile/meta`
  - `heightCm`, `currentWeightKg`, `goalWeightKg`, `goalDate`
- `users/{uid}/workoutLogs/{YYYY-MM-DD}`
  - `date`, `sessionType`, `completedSteps[]`, `notes`
- `users/{uid}/foodLogs/{autoId}`
  - `eatenAt`, `eatenAtMs`, `meal`, `calorieLevel`, `notes`
- `users/{uid}/weightLogs/{YYYY-MM-DD}`
  - `date`, `weightKg`, `note`

## Run Locally

Use any static server from this folder.

Example:

```bash
npx serve .
```

Then open the URL from the terminal and start at `login.html`.
