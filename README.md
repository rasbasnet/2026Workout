# Workout Hub

A multi-page workout website with Firebase login, workout tracking, food tracking, daily weight logging, and chart-based analytics.

## Pages

- `login.html` - Firebase Google auth
- `index.html` - Dashboard (daily weight + metrics)
- `profile.html` - Edit profile and goal values
- `routine.html` - Routine guide (video panels can be collapsed for focus mode)
- `workout-tracker.html` - Track completed workout steps by day + notes
- `food-tracker.html` - Track meals + time + calorie intensity + notes
- `data-chart.html` - Auto-generated charts and trend summary

## UX Flow

1. First login shows a required profile setup popup on the Dashboard.
2. After first save, profile is edited from `profile.html`.
3. Workout/Food/Daily weight forms support quick date-time presets.
4. Every tracker save can jump directly to Charts using `Save + open charts`.

## Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable `Authentication -> Sign-in method -> Google`.
3. Enable Cloud Firestore in production or test mode.
4. Open `/Users/rasbasnet/Documents/code/2026Workout/js/firebase.js` and replace all `REPLACE_ME` values with your Firebase web app config.
5. Apply Firestore rules from `/Users/rasbasnet/Documents/code/2026Workout/firestore.rules`.
6. In `Authentication -> Settings -> Authorized domains`, add:
   - `rasbasnet.github.io`
   - `localhost` (for local testing)

## Save Troubleshooting

- If save actions fail with permissions errors:
  1. Open Firebase Console -> Firestore Database -> Rules
  2. Paste rules from `/Users/rasbasnet/Documents/code/2026Workout/firestore.rules`
  3. Publish rules, then refresh the app
- If save actions fail with `failed-precondition`, enable Firestore first.

## Data Model

- `users/{uid}/profile/meta`
  - `heightCm`, `currentWeightKg`, `goalWeightKg`, `goalDate`
- `users/{uid}/workoutLogs/{YYYY-MM-DD}`
  - `date`, `sessionType`, `completedSteps[]`, `notes`
- `users/{uid}/foodLogs/{autoId}`
  - `eatenAt`, `eatenAtMs`, `meal`, `mealType`, `calorieLevel`, `notes`
- `users/{uid}/weightLogs/{YYYY-MM-DD}`
  - `date`, `weightKg`, `note`

## Run Locally

Use any static server from this folder.

Example:

```bash
npx serve .
```

Then open the URL from the terminal and start at `login.html`.
