# Cross-Repo Sync Action

[![Type Check](https://github.com/your-username/cross-repo-sync-action/actions/workflows/type-check.yml/badge.svg)](https://github.com/your-username/cross-repo-sync-action/actions/workflows/type-check.yml)
[![Test Action](https://github.com/your-username/cross-repo-sync-action/actions/workflows/test-action.yml/badge.svg)](https://github.com/your-username/cross-repo-sync-action/actions/workflows/test-action.yml)

A GitHub Action that syncs and renames files or folders from your repository to a different repository and branch.

## Features

- 🔄 **Cross-Repository Sync**: Push files from one repo to another automatically
- 📁 **Path Rewriting**: Restructure files in the destination repository
- 🎯 **Selective Sync**: Choose exactly which files/folders to sync
- 🤖 **Automated Commits**: Handles git operations automatically
- 🔒 **Secure**: Uses Personal Access Tokens for authentication
- ⚡ **Fast**: Built with Effect-TS and tsx for TypeScript execution

## Usage

### Basic Example

```yaml
name: 'Sync Documentation'
on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Sync to Wiki
        uses: your-username/your-repo/actions/cross-repo-sync@main
        with:
          personal_access_token: ${{ secrets.DOCS_PAT }}
          sync_paths: |
            docs:content/documentation
            README.md
          destination_repo: 'my-org/wiki-repo'
```

### Advanced Example with Path Rewriting

```yaml
- name: Sync Multiple Paths
  uses: your-username/your-repo/actions/cross-repo-sync@main
  with:
    personal_access_token: ${{ secrets.SYNC_PAT }}
    sync_paths: |
      build/docs:content/v2
      README.md:docs/README.md
      "assets/logo.png":"images/brand/logo.png"
      "my folder/file.txt":"renamed file.txt"
    destination_repo: 'target-org/target-repo'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `personal_access_token` | A Personal Access Token with `repo` scope | ✅ | - |
| `sync_paths` | Multi-line string of source:destination mappings | ✅ | - |
| `destination_repo` | Target repository in `owner/repo` format | ✅ | - |

### Sync Paths Format

- **Basic**: `source/path:destination/path`
- **To Root**: `source/file.txt` (copies to root of destination repo)
- **Quoted Paths**: `"path with spaces":"destination with spaces"`
- **Multiple Lines**: Each mapping on its own line

## Outputs

| Output | Description |
|--------|-------------|
| `commit_hash` | The git hash of the new commit (empty if no changes) |

## Requirements

### Personal Access Token

You need a Personal Access Token (PAT) with appropriate scopes:

**Required Scopes:**
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows (only if syncing workflow files)

**Setup Steps:**
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Generate a new token with the required scopes
3. Add it as a secret in your repository settings
4. Use it in the `personal_access_token` input

> ⚠️ **Security Note:** The default `GITHUB_TOKEN` will **not** work for pushing to other repositories. A PAT is required for cross-repo operations.

> 💡 **Best Practice:** Use fine-grained tokens with minimal necessary permissions and set appropriate expiration dates.

> 🔒 **Token Security:** Tokens are automatically URL-encoded and masked in logs to prevent exposure of special characters and sensitive data.

### Node.js 20+

This action requires Node.js 20 or later.

## Examples

### Documentation Sync

Sync documentation from a main project to a documentation repository:

```yaml
sync_paths: |
  docs/api:content/api-reference
  docs/guides:content/user-guides
  CHANGELOG.md:content/changelog.md
```

### Asset Deployment

Deploy built assets to a separate deployment repository:

```yaml
sync_paths: |
  dist:public
  assets/images:static/images
  build/manifest.json:public/manifest.json
```

### Monorepo Package Sync

Sync a package from a monorepo to a standalone repository:

```yaml
sync_paths: |
  packages/ui:src
  packages/ui/README.md:README.md
  packages/ui/package.json:package.json
```

## Development

### Setup

```bash
cd actions/cross-repo-sync
npm install
```

### Type Checking

```bash
npm run typecheck
```

### Running Locally

```bash
npm run start
```

### Testing Locally

**Option 1: Using dry-run mode**
```yaml
- uses: your-username/your-repo/actions/cross-repo-sync@main
  with:
    personal_access_token: ${{ secrets.PAT }}
    dry_run: true
    sync_paths: |
      docs:content/documentation
      README.md
    destination_repo: 'target-org/target-repo'
```

**Option 2: Using act for local testing**
```bash
act -W .github/workflows/test-action.yml
```

**Option 3: Manual testing**
```bash
# Set environment variables
export INPUT_PERSONAL_ACCESS_TOKEN="your-token"
export INPUT_SYNC_PATHS="README.md"
export INPUT_DESTINATION_REPO="test-org/test-repo"
export INPUT_DRY_RUN="true"

# Run the action
npm run start
```

## Technical Details

- **Framework**: Effect-TS for functional programming and error handling
- **File Operations**: Effect Platform FileSystem for type-safe file operations
- **Command Execution**: Effect Platform Command API for type-safe shell command execution
- **Path Handling**: Node.js path.join for cross-platform path resolution
- **Runtime**: tsx for TypeScript execution without build step
- **Action Type**: Composite action for maximum flexibility
- **Git Operations**: Automated clone, commit, and push operations
- **Security**: URL-encoded tokens, input validation, and path safety checks

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run type checking: `npm run typecheck`
5. Test your changes
6. Submit a pull request

## Support

- 📚 [Documentation](https://github.com/your-username/cross-repo-sync-action/wiki)
- 🐛 [Issue Tracker](https://github.com/your-username/cross-repo-sync-action/issues)
- 💬 [Discussions](https://github.com/your-username/cross-repo-sync-action/discussions)