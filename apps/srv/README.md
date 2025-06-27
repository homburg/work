# srv - Next.js Web Application

A modern Next.js web application showcasing functional programming with Effect and enterprise-grade observability with OpenTelemetry.

## 🚀 Features

- **Next.js 15**: Latest version with App Router and Turbopack
- **Effect Library**: Functional programming with composable effects
- **OpenTelemetry**: Comprehensive observability and tracing
- **TailwindCSS 4**: Latest utility-first CSS framework
- **TypeScript**: Full type safety throughout the application
- **Modern Development**: ESLint and hot reload with Turbopack

## 🏗️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4 with PostCSS
- **State Management**: Effect library for functional programming
- **Observability**: 
  - OpenTelemetry API & SDK
  - Vercel OTel integration
  - Comprehensive logging and tracing
- **Package Manager**: Yarn 4
- **Development**: Turbopack for fast builds

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Yarn 4+ (configured via packageManager)

### Installation & Running

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Start the development server**:
   ```bash
   yarn dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

```bash
yarn dev      # Start development server with Turbopack
yarn build    # Build for production
yarn start    # Start production server
yarn lint     # Run ESLint
```

## 🔧 Development

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file thanks to Turbopack's fast refresh.

### Effect Library Integration

This project uses the Effect library for functional programming:
- **@effect/platform**: Cross-platform effects
- **@effect/platform-node**: Node.js specific effects
- Effect provides composable, type-safe error handling and async operations

### OpenTelemetry Setup

The application includes comprehensive observability:
- **Automatic instrumentation** for Next.js requests
- **Custom logging** with structured logs
- **Distributed tracing** ready for production monitoring
- **Vercel integration** for seamless deployment observability

### Styling

This project uses TailwindCSS 4 with PostCSS for styling. The configuration supports:
- Modern CSS features
- Utility-first approach
- Responsive design
- Dark mode support (configurable)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
