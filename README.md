# Influence Hub

An open-source social media analytics and insights aggregator that connects to multiple platforms (Facebook, YouTube, Twitter, Reddit, TikTok, Instagram, Discord) to provide AI-powered trend analysis and audience interaction statistics.

## Features

- **Multi-Platform Integration**: Connect to major social media platforms via API tokens
- **Analytics Dashboard**: Real-time insights and trend analysis
- **MCP Server**: Model Context Protocol server for AI integration
- **Self-Hosted**: Deploy on your own infrastructure
- **Secure Token Management**: Encrypted storage of API credentials
- **AI-Powered Insights**: Automated trend detection and audience analysis

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-username/influence-hub
cd influence-hub
npm install

# Configure your API tokens
cp .env.example .env
# Edit .env with your API credentials (see docs/API_SETUP.md)

# Build and start
npm run build
npm run dev
```

### MCP Server Usage

```bash
# Start as MCP server for AI integration
npm run mcp

# Or use with Claude Desktop (see docs/MCP_INTEGRATION.md)
```

## Supported Platforms

- Facebook/Meta API
- YouTube Data API
- Twitter/X API
- Reddit API
- TikTok API
- Instagram Basic Display API
- Discord API

## Architecture

- **Core Service**: Node.js/TypeScript backend
- **MCP Server**: For AI model integration
- **Analytics Engine**: Real-time data processing
- **Token Manager**: Secure credential storage
- **Platform Connectors**: Modular API integrations

## API Endpoints

- **GET** `/` - API information and health check
- **GET** `/status` - Server status and platform connections  
- **GET** `/metrics?timeRange=7` - Aggregated social media metrics
- **GET** `/trends?timeRange=7` - Trending topics and insights
- **GET** `/platforms` - List configured platforms
- **POST** `/platforms/:platform/configure` - Add platform credentials
- **DELETE** `/platforms/:platform` - Remove platform

## Documentation

- [API Setup Guide](docs/API_SETUP.md) - Configure social media platform APIs
- [MCP Integration](docs/MCP_INTEGRATION.md) - Use with Claude and other AI models

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.