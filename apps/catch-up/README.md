# catch-up - Expo Mobile Application 📱

A modern cross-platform mobile application built with Expo and React Native, featuring file-based routing and native platform integrations.

## � Features

- **Cross-Platform**: Runs on iOS, Android, and Web
- **Expo Router**: File-based routing with nested navigation
- **TypeScript**: Full type safety throughout the application
- **Native Integrations**: Blur effects, haptics, symbols, and more
- **Modern Navigation**: Bottom tabs with React Navigation
- **Development Tools**: Hot reload, debugging, and testing setup

## 🏗️ Tech Stack

- **Framework**: Expo SDK 52 with React Native 0.76
- **Language**: TypeScript
- **Navigation**: 
  - Expo Router 4 (file-based routing)
  - React Navigation 7 (bottom tabs)
- **UI Components**: 
  - Expo Vector Icons
  - Expo Symbols
  - Expo Blur effects
- **Native Features**:
  - Haptics feedback
  - Status bar control
  - Deep linking
  - Web browser integration
- **Package Manager**: Yarn 4
- **Testing**: Jest with Expo preset

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Yarn 4+ (configured via packageManager)
- iOS Simulator (for iOS development)
- Android Studio & Emulator (for Android development)
- Expo CLI (installed automatically)

### Installation & Running

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Start the development server**:
   ```bash
   yarn start
   ```

3. **Choose your platform**:
   In the output, you'll find options to open the app in:
   - **Development build** (recommended for production features)
   - **Android emulator** (requires Android Studio)
   - **iOS simulator** (requires Xcode on macOS)
   - **Expo Go** (limited sandbox for quick testing)
   - **Web browser** (for web development)

### Available Scripts

```bash
yarn start           # Start Expo development server
yarn android         # Run on Android emulator/device
yarn ios            # Run on iOS simulator/device  
yarn web            # Run in web browser
yarn test           # Run Jest tests in watch mode
yarn lint           # Run Expo linting
yarn reset-project  # Reset to blank project template
```

## 🔧 Development

### File-Based Routing

This project uses [Expo Router](https://docs.expo.dev/router/introduction) with file-based routing. You can start developing by editing files inside the **app** directory:

```
app/
├── (tabs)/          # Tab-based layout
├── +not-found.tsx   # 404 page
└── _layout.tsx      # Root layout
```

### Navigation Structure

The app uses bottom tab navigation with:
- **React Navigation 7** for tab management
- **Expo Router** for file-based routing
- **Deep linking** support built-in

### Native Features

The application includes several native integrations:
- **Haptic feedback** for user interactions
- **Blur effects** for modern UI
- **System UI** controls for status bar
- **Gesture handling** for smooth interactions
- **WebView** for embedded web content

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
