# POC Portal

A modern, containerized portal for running Proof of Concept (POC) evaluations and demos with dynamic use case management.

## Features

- **Dynamic Use Case Loading**: Use cases are stored as Markdown + YAML files
- **Form-Based Authentication**: Secure login with configurable credentials
- **Configuration Page**: Manage POC settings, enable/disable use cases, drag-and-drop ordering
- **Variable Replacement**: Automatic replacement of `@@PROSPECT@@`, `@@PASSWORD@@`, etc.
- **Completion Tracking**: Track progress through use cases with persistence
- **Feedback System**: Collect ratings and feedback for each use case
- **Remote Updates**: Download new use cases from S3/GitHub
- **POC Insights**: Send telemetry to external endpoint (optional)

## Quick Start

### Using Docker

```bash
docker-compose up -d
```

Then open http://localhost:3000

Default credentials:
- Username: `admin`
- Password: `password`

### Using Node.js

```bash
npm install
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `PROSPECT` | Customer/prospect name | `demo` |
| `PARTNER` | Partner name | (empty) |
| `SAAS_NAME` | Product name | `Certificate Manager` |
| `POC_START_DATE` | POC start date (YYYY-MM-DD) | Today |
| `POC_END_DATE` | POC end date (YYYY-MM-DD) | Today + 30 days |
| `POC_OR_DEMO` | Mode: `poc` or `demo` | `demo` |
| `POC_INSIGHTS_URL` | URL for telemetry (POC mode only) | (empty) |
| `USE_CASE_REPO_URL` | Remote repo for use cases | (empty) |
| `AUTH_USERNAME` | Login username | `admin` |
| `AUTH_PASSWORD` | Login password | `password` |
| `TLSPC_URL` | TLS Protect Cloud URL | `https://ui.venafi.cloud` |
| `DEFAULT_PASSWORD` | Default password for labs | `ChangeMe123!` |

## Use Case Structure

Use cases are stored in `/use-cases/{product-category}/`:

```
use-cases/
  machine-identity/
    welcome.md          # Markdown content
    welcome.yaml        # Configuration
    dashboard.md
    dashboard.yaml
```

### YAML Configuration

```yaml
name: "Welcome to Your Evaluation"
version: "1.0.0"
description: "Introduction to the POV environment"
product: "Certificate Manager SaaS"
productCategory: "Machine Identity"
category: "Housekeeping"
categoryOrder: 1
useCaseOrder: 1
estimatedHours: 0.25
customerPreparation: "Ensure browser is ready"

credentials:
  - text: "Login details"
    url: "@@TLSPCURL@@"
    username: "administrator"
    password: "@@PASSWORD@@"
```

### Variable Placeholders

Use these placeholders in both `.md` and `.yaml` files:

- `@@PROSPECT@@` - Customer name
- `@@PARTNER@@` - Partner name
- `@@SAAS_NAME@@` - Product name
- `@@TLSPCURL@@` - TLS Protect Cloud URL
- `@@PASSWORD@@` - Default password
- `@@POC_START_DATE@@` - POC start date
- `@@POC_END_DATE@@` - POC end date

## Configuration Page

Access the configuration page at `/config` to:

1. **Set POC Variables**: Prospect name, dates, mode
2. **Enable/Disable Use Cases**: Select which use cases to show
3. **Reorder Use Cases**: Drag and drop to change order
4. **Check for Updates**: Download new use cases from remote
5. **Generate Config String**: Copy environment variables for new deployments

## Persistent Storage

When using Docker, mount a volume to `/app/data` to persist:
- `config.json` - Configuration settings
- `completedUseCases.json` - Completion tracking
- `feedback.json` - User feedback

## Remote Use Case Repository

Set `USE_CASE_REPO_URL` to a public URL hosting your use cases:

```
https://your-bucket.s3.amazonaws.com/use-cases/
  manifest.json
  machine-identity/
    welcome.md
    welcome.yaml
```

The `manifest.json` should list available use cases:

```json
{
  "useCases": [
    { "id": "machine-identity/welcome", "name": "Welcome", "version": "1.0.0" }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev
```

## License

Proprietary - All rights reserved
