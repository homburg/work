# GitHub Actions Monorepo

This repository contains a collection of custom GitHub Actions.

## Actions

### 🔄 Cross-Repo Sync

**Location:** [`actions/cross-repo-sync/`](actions/cross-repo-sync/)

A GitHub Action that syncs and renames files or folders from your repository to a different repository and branch.

**Features:**
- Cross-repository file synchronization
- Path rewriting and restructuring
- Selective sync with multi-line path mappings
- Built with Effect-TS and TypeScript

**Usage:**
```yaml
- uses: your-username/your-repo/actions/cross-repo-sync@main
  with:
    personal_access_token: ${{ secrets.PAT }}
    sync_paths: |
      docs:content/documentation
      README.md
    destination_repo: 'target-org/target-repo'
```

[📖 Full Documentation](actions/cross-repo-sync/README.md)

## Development

### Repository Structure

```
actions/
├── cross-repo-sync/           # Cross-Repo Sync Action
│   ├── action.yml            # Action definition
│   ├── src/                  # TypeScript source
│   ├── package.json          # Dependencies
│   └── README.md             # Action documentation
└── ...                       # Future actions

apps/                         # Other applications (if any)
```

### Adding New Actions

1. Create a new directory under `actions/`
2. Add `action.yml` with the action definition
3. Implement the action logic
4. Add documentation and tests
5. Update this README

## License

MIT License - see individual action directories for specific license files.