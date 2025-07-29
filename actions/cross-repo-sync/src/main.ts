import * as core from "@actions/core"
import { Effect, Layer, pipe } from "effect"
import { FileSystem, Command, CommandExecutor } from "@effect/platform"
import { NodeFileSystem, NodeRuntime, NodeCommandExecutor } from "@effect/platform-node"

// Types for our domain
interface ActionInputs {
  readonly personalAccessToken: string
  readonly syncPaths: ReadonlyArray<readonly [string, string]>
  readonly destinationRepo: string
  readonly dryRun: boolean
}

interface GitConfig {
  readonly userName: string
  readonly userEmail: string
}

// Helper function for executing git commands using Effect Command
const executeCommand = (command: string, args: ReadonlyArray<string> = [], cwd?: string): Effect.Effect<string, Error, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const cmd = Command.make(command, ...args)
    const cmdWithCwd = cwd ? cmd.pipe(Command.workingDirectory(cwd)) : cmd
    
    const result = yield* cmdWithCwd.pipe(
      Command.string,
      Effect.mapError((error) => new Error(`Command failed: ${command} ${args.join(' ')}\n${String(error)}`))
    )
    
    return result.trim()
  })

// Parse action inputs
const parseInputs = Effect.gen(function* () {
  const personalAccessToken = core.getInput("personal_access_token", { required: true })
  const syncPathsInput = core.getInput("sync_paths", { required: true })
  const destinationRepo = core.getInput("destination_repo", { required: true })
  const dryRun = core.getInput("dry_run", { required: false }) === "true"

  // Mask sensitive token in logs
  core.setSecret(personalAccessToken)

  if (!personalAccessToken) {
    return yield* Effect.fail(new Error("personal_access_token is required"))
  }
  
  if (!destinationRepo) {
    return yield* Effect.fail(new Error("destination_repo is required"))
  }

  // Validate repository format (owner/repo)
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(destinationRepo)) {
    return yield* Effect.fail(new Error(`Invalid repository format: ${destinationRepo}. Expected format: owner/repo`))
  }

  if (!syncPathsInput.trim()) {
    return yield* Effect.fail(new Error("sync_paths is required"))
  }

  // Parse sync paths
  const syncPaths: Array<readonly [string, string]> = []
  
  for (const line of syncPathsInput.split("\n")) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    
    const colonIndex = trimmedLine.indexOf(":")
    if (colonIndex === -1) {
      // No destination specified, copy to root
      const cleanSource = trimmedLine.replace(/^"(.*)"$/, "$1")
      
      // Validate path safety
      if (cleanSource.includes("..") || cleanSource.startsWith("/")) {
        core.warning(`Potentially unsafe path detected and skipped: ${cleanSource}`)
        continue
      }
      
      syncPaths.push([cleanSource, cleanSource])
    } else {
      const source = trimmedLine.slice(0, colonIndex).trim()
      const destination = trimmedLine.slice(colonIndex + 1).trim()
      
      // Handle quoted paths
      const cleanSource = source.replace(/^"(.*)"$/, "$1")
      const cleanDestination = destination.replace(/^"(.*)"$/, "$1")
      
      // Validate path safety
      if (cleanSource.includes("..") || cleanSource.startsWith("/") || 
          cleanDestination.includes("..") || cleanDestination.startsWith("/")) {
        core.warning(`Potentially unsafe path detected and skipped: ${cleanSource} -> ${cleanDestination}`)
        continue
      }
      
      syncPaths.push([cleanSource, cleanDestination])
    }
  }

  if (syncPaths.length === 0) {
    return yield* Effect.fail(new Error("No valid sync paths found"))
  }

  return {
    personalAccessToken,
    syncPaths,
    destinationRepo,
    dryRun
  } satisfies ActionInputs
})

// Configure git user
const configureGit = (config: GitConfig): Effect.Effect<void, Error, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    yield* executeCommand("git", ["config", "--global", "user.name", config.userName])
    yield* executeCommand("git", ["config", "--global", "user.email", config.userEmail])
  })

// Clone destination repository
const cloneRepo = (inputs: ActionInputs, tempDir: string): Effect.Effect<string, Error, FileSystem.FileSystem | CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    
    // Create temp directory if it doesn't exist
    yield* fs.makeDirectory(tempDir, { recursive: true }).pipe(
      Effect.mapError((error) => new Error(`Failed to create temp directory: ${String(error)}`)),
      Effect.ignore
    )
    
    const repoUrl = `https://${inputs.personalAccessToken}@github.com/${inputs.destinationRepo}.git`
    const cloneDir = `${tempDir}/destination-repo`
    
    // Remove existing clone directory if it exists
    yield* fs.remove(cloneDir, { recursive: true }).pipe(
      Effect.mapError((error) => new Error(`Failed to remove existing directory: ${String(error)}`)),
      Effect.ignore
    )
    
    yield* executeCommand("git", ["clone", repoUrl, cloneDir])
    
    return cloneDir
  })

// Copy files according to sync paths
const copyFiles = (inputs: ActionInputs, cloneDir: string): Effect.Effect<void, Error, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    
    for (const [source, destination] of inputs.syncPaths) {
      // Check if source exists
      const sourceExists = yield* fs.exists(source).pipe(
        Effect.mapError((error) => new Error(`Failed to check if source exists: ${String(error)}`))
      )
      if (!sourceExists) {
        core.warning(`Source path does not exist: ${source}`)
        continue
      }
      
      const destPath = `${cloneDir}/${destination}`
      const lastSlashIndex = destPath.lastIndexOf('/')
      const destDir = lastSlashIndex === -1 ? cloneDir : destPath.substring(0, lastSlashIndex)
      
      // Create destination directory if it doesn't exist
      yield* fs.makeDirectory(destDir, { recursive: true }).pipe(
        Effect.mapError((error) => new Error(`Failed to create destination directory: ${String(error)}`)),
        Effect.ignore
      )
      
      // Check if source is a directory or file
      const sourceInfo = yield* fs.stat(source).pipe(
        Effect.mapError((error) => new Error(`Failed to stat source file: ${String(error)}`))
      )
      
      if (sourceInfo.type === "Directory") {
        // Copy directory recursively
        yield* copyDirectoryRecursive(fs, source, destPath).pipe(
          Effect.mapError((error) => new Error(`Failed to copy directory ${source}: ${String(error)}`))
        )
      } else {
        // Copy single file
        yield* fs.copy(source, destPath).pipe(
          Effect.mapError((error) => new Error(`Failed to copy file ${source}: ${String(error)}`))
        )
      }
      
      core.info(`Copied ${source} -> ${destination}`)
    }
  })

// Helper function to copy directory recursively
const copyDirectoryRecursive = (fs: FileSystem.FileSystem, source: string, dest: string): Effect.Effect<void, any> =>
  Effect.gen(function* () {
    // Create destination directory
    yield* fs.makeDirectory(dest, { recursive: true })
    
    // Read source directory contents
    const entries = yield* fs.readDirectory(source)
    
    for (const entry of entries) {
      const sourcePath = `${source}/${entry}`
      const destPath = `${dest}/${entry}`
      
      // Check if entry is a directory
      const entryInfo = yield* fs.stat(sourcePath)
      
      if (entryInfo.type === "Directory") {
        // Recursively copy subdirectory
        yield* copyDirectoryRecursive(fs, sourcePath, destPath)
      } else {
        // Copy file
        yield* fs.copy(sourcePath, destPath)
      }
    }
  })

// Check for changes and commit/push if needed
const commitAndPush = (cloneDir: string): Effect.Effect<string, Error, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    // Check if there are any changes
    const status = yield* executeCommand("git", ["status", "--porcelain"], cloneDir)
    
    if (!status.trim()) {
      core.info("No changes detected, skipping commit and push")
      return ""
    }
    
    // Add all changes
    yield* executeCommand("git", ["add", "."], cloneDir)
    
    // Commit changes
    const commitMessage = "chore: Sync files from source repository"
    yield* executeCommand("git", ["commit", "-m", commitMessage], cloneDir)
    
    // Push changes
    yield* executeCommand("git", ["push", "origin", "main"], cloneDir)
    
    // Get the commit hash
    const commitHash = yield* executeCommand("git", ["rev-parse", "HEAD"], cloneDir)
    
    core.info(`Successfully pushed changes with commit hash: ${commitHash}`)
    return commitHash
  })

// Main program
const program = Effect.gen(function* () {
  const inputs = yield* parseInputs
  
  core.info(`🚀 Starting cross-repo sync to ${inputs.destinationRepo}${inputs.dryRun ? " (DRY RUN)" : ""}`)
  core.info(`📁 Found ${inputs.syncPaths.length} sync path(s):`)
  inputs.syncPaths.forEach(([s, d], index) => {
    core.info(`   ${index + 1}. ${s} -> ${d}`)
  })
  
  if (inputs.dryRun) {
    core.info("🧪 Running in dry-run mode - no actual changes will be made")
  }
  
  const tempDir = "/tmp/cross-repo-sync"
  const gitConfig: GitConfig = {
    userName: "github-actions[bot]",
    userEmail: "github-actions[bot]@users.noreply.github.com"
  }
  
  // Configure git
  yield* configureGit(gitConfig)
  
  // Clone destination repo
  const cloneDir = yield* cloneRepo(inputs, tempDir)
  
  // Copy files
  yield* copyFiles(inputs, cloneDir)
  
  // Commit and push changes
  const commitHash = yield* commitAndPush(cloneDir)
  
  // Set output
  core.setOutput("commit_hash", commitHash)
  
  // Cleanup
  const fs = yield* FileSystem.FileSystem
  yield* fs.remove(tempDir, { recursive: true }).pipe(
    Effect.mapError((error) => new Error(`Failed to cleanup temp directory: ${String(error)}`)),
    Effect.ignore
  )
  
  core.info("✅ Cross-repo sync completed successfully")
})

// Run the program
const layers = Layer.mergeAll(NodeFileSystem.layer, NodeCommandExecutor.layer)

Effect.runPromise(
  program.pipe(
    Effect.provide(layers)
  ) as Effect.Effect<void, Error, never>
).catch((error: unknown) => {
  core.setFailed(`Action failed: ${String(error)}`)
  process.exit(1)
})