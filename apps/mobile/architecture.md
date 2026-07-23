# TrivioQ Mobile (`apps/mobile`)

The Mobile app is the primary client for end-users to participate in trivia drops on iOS and Android devices.

## Technical Stack

- **Framework:** React Native with Expo
- **Navigation:** React Navigation (Native Stack, Bottom Tabs)
- **Key Dependencies:** Firebase, React Query (data fetching), i18next (localization), AsyncStorage, React Native Markdown Display (for rendering complex questions with MathJax support).

## Key Functionalities

- **Authentication:** Login and Signup screens (including Google Sign-In).
- **Home Dashboard:** Displays current status, active drops, and upcoming trivia sessions.
- **Drop Active:** The core game screen where users answer trivia questions during a live drop.
- **History:** Displays a user's past performance and answered drops.
- **Leaderboard:** Shows global and potentially local rankings.
- **Notifications:** In-app inbox for system alerts and drop reminders.
- **Profile & Preferences:** User account settings, avatar management, and app preferences (like theme/language).
- **Subscription:** Screen for users to purchase and manage premium features or access.
- **Legal:** Viewing Privacy Policy and Terms of Service.
