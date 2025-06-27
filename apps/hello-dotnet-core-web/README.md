# Hello .NET Core Web API

A minimal .NET 8 web API that demonstrates the simplicity and power of .NET's minimal API approach.

## 🚀 Features

- **Minimal API**: Clean, simple endpoint definition
- **.NET 8**: Latest stable version of .NET
- **No controllers**: Direct endpoint mapping for maximum simplicity
- **Built-in DI**: Dependency injection ready
- **Cross-platform**: Runs on Windows, macOS, and Linux

## 🏗️ Project Structure

```
hello-dotnet-core-web/
├── Program.cs                  # Main application entry point
├── hello-dotnet-core-web.csproj # Project configuration
├── appsettings.json           # Application configuration
├── appsettings.Development.json # Development-specific settings
└── Properties/
    └── launchSettings.json    # Launch profiles
```

## 🚀 Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

### Installation & Running

1. **Navigate to the project directory**:
   ```bash
   cd apps/hello-dotnet-core-web
   ```

2. **Restore dependencies** (if any):
   ```bash
   dotnet restore
   ```

3. **Run the application**:
   ```bash
   dotnet run
   ```

4. **Access the API**:
   - Open your browser and go to: [http://localhost:5000](http://localhost:5000)
   - Or use curl: `curl http://localhost:5000`
   - You should see: `Hello World!`

### Development Mode

For development with hot reload:
```bash
dotnet watch run
```

## 📡 API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET    | `/`      | Root endpoint | `Hello World!` |

## 🔧 Development

### Building the Project
```bash
dotnet build
```

### Publishing for Production
```bash
dotnet publish -c Release -o ./publish
```

### Running Tests
```bash
dotnet test
```

## 🌐 Configuration

### Environment Settings

The application uses standard .NET configuration:

- **appsettings.json**: Base configuration
- **appsettings.Development.json**: Development overrides
- **Environment variables**: Override any setting

### Port Configuration

Default ports:
- **Development**: http://localhost:5000, https://localhost:5001
- **Production**: Configured via environment or hosting platform

To change the port:
```bash
dotnet run --urls "http://localhost:8080"
```

## 📦 Deployment

### Docker (Optional)

Create a `Dockerfile`:
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY ./publish .
ENTRYPOINT ["dotnet", "hello-dotnet-core-web.dll"]
```

Build and run:
```bash
docker build -t hello-dotnet-api .
docker run -p 8080:80 hello-dotnet-api
```

### Cloud Deployment

This minimal API can be deployed to:
- **Azure App Service**
- **AWS Elastic Beanstalk**
- **Google Cloud Run**
- **Heroku**
- **Any container platform**

## 🧪 Adding Features

### Adding More Endpoints

Edit `Program.cs`:
```csharp
app.MapGet("/api/users", () => new { message = "Users endpoint" });
app.MapPost("/api/users", (User user) => Results.Created($"/api/users/{user.Id}", user));
```

### Adding Middleware

```csharp
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
```

### Adding Services

```csharp
builder.Services.AddScoped<IUserService, UserService>();
```

## 📚 Learn More

- [.NET 8 Documentation](https://docs.microsoft.com/en-us/dotnet/)
- [Minimal APIs Guide](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis)
- [ASP.NET Core Documentation](https://docs.microsoft.com/en-us/aspnet/core/)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Note**: This is a minimal starting point. Extend it based on your specific requirements!