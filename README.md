# Multi-App Monorepo

This repository contains three distinct applications showcasing different technologies and platforms:

## 🏗️ Project Structure

```
apps/
├── srv/                     # Next.js web application with Effect
├── catch-up/               # Expo/React Native mobile app
└── hello-dotnet-core-web/  # .NET 8 minimal web API
```

## 📱 Applications

### 🌐 srv (Web Application)
A modern Next.js web application built with:
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS 4
- **State Management**: Effect library for functional programming
- **Observability**: OpenTelemetry instrumentation
- **Package Manager**: Yarn 4

[📖 Read more →](./apps/srv/README.md)

### 📱 catch-up (Mobile Application)
A cross-platform mobile application built with:
- **Framework**: Expo/React Native
- **Language**: TypeScript
- **Navigation**: Expo Router with file-based routing
- **Platforms**: iOS, Android, Web
- **Package Manager**: Yarn 4

[📖 Read more →](./apps/catch-up/README.md)

### 🔧 hello-dotnet-core-web (Web API)
A minimal web API built with:
- **Framework**: .NET 8
- **Language**: C#
- **Type**: Minimal API
- **Features**: Simple "Hello World" endpoint

[📖 Read more →](./apps/hello-dotnet-core-web/README.md)

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **Yarn** 4+ (for srv and catch-up)
- **.NET 8 SDK** (for hello-dotnet-core-web)

### Running All Applications

#### Web Application (srv)
```bash
cd apps/srv
yarn install
yarn dev
```
Open [http://localhost:3000](http://localhost:3000)

#### Mobile Application (catch-up)
```bash
cd apps/catch-up
yarn install
yarn start
```
Follow the Expo CLI instructions to run on your preferred platform.

#### Web API (hello-dotnet-core-web)
```bash
cd apps/hello-dotnet-core-web
dotnet run
```
API available at [http://localhost:5000](http://localhost:5000)

## 🔧 Development

Each application has its own development environment and dependencies. Refer to the individual README files for detailed setup instructions and development workflows.

## 📚 Documentation

- [srv README](./apps/srv/README.md) - Next.js web application
- [catch-up README](./apps/catch-up/README.md) - Expo mobile application  
- [hello-dotnet-core-web README](./apps/hello-dotnet-core-web/README.md) - .NET web API

## 🤝 Contributing

1. Clone the repository
2. Navigate to the specific app directory
3. Follow the app-specific setup instructions
4. Make your changes
5. Submit a pull request

## 📄 License

This project is for demonstration and learning purposes.