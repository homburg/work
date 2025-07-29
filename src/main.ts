import * as core from "@actions/core"
import { Effect, Layer, pipe, Context } from "effect"
import { execSync } from "child_process"
import { existsSync, mkdirSync, rmSync } from "fs"
import { dirname, join } from "path"

// Types for our domain
interface ActionInputs {
  readonly personalAccessToken: string
  readonly syncPaths: ReadonlyArray<readonly [string, string]>
  readonly destinationRepo: string
}

interface GitConfig {
  readonly userName: string
  readonly userEmail: string
}

// Service for executing shell commands
interface CommandService {
  readonly execute: (command: string, cwd?: string) => Effect.Effect<string, Error>
}

const CommandService = Context.GenericTag<CommandService>("CommandService")

// Parse action inputs
const parseInputs = Effect.gen(function* () {
  const personalAccessToken = core.getInput("personal_access_token", { required: true })
  const syncPathsInput = core.getInput("sync_paths", { required: true })
  const destinationRepo = core.getInput("destination_repo", { required: true })

  if (!personalAccessToken) {
    return yield* Effect.fail(new Error("personal_access_token is required"))
  }
  
  if (!destinationRepo) {
    return yield* Effect.fail(new Error("destination_repo is required"))
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
      syncPaths.push([trimmedLine, trimmedLine])
    } else {
      const source = trimmedLine.slice(0, colonIndex).trim()
      const destination = trimmedLine.slice(colonIndex + 1).trim()
      
      // Handle quoted paths
      const cleanSource = source.replace(/^"(.*)"$/, "$1")
      const cleanDestination = destination.replace(/^"(.*)"$/, "$1")
      
      syncPaths.push([cleanSource, cleanDestination])
    }
  }

  if (syncPaths.length === 0) {
    return yield* Effect.fail(new Error("No valid sync paths found"))
  }

  return {
    personalAccessToken,
    syncPaths,
    destinationRepo
  } satisfies ActionInputs
})

// Configure git user
const configureGit = (config: GitConfig) =>
  Effect.gen(function* () {
    const commandService = yield* CommandService
    
    yield* commandService.execute(`git config --global user.name "${config.userName}"`)
    yield* commandService.execute(`git config --global user.email "${config.userEmail}"`)
  })

// Clone destination repository
const cloneRepo = (inputs: ActionInputs, tempDir: string) =>
  Effect.gen(function* () {
    const commandService = yield* CommandService
    
    // Create temp directory if it doesn't exist
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }
    
    const repoUrl = `https://${inputs.personalAccessToken}@github.com/${inputs.destinationRepo}.git`
    const cloneDir = join(tempDir, "destination-repo")
    
    // Remove existing clone directory if it exists
    if (existsSync(cloneDir)) {
      rmSync(cloneDir, { recursive: true, force: true })
    }
    
    yield* commandService.execute(`git clone "${repoUrl}" "${cloneDir}"`)
    
    return cloneDir
  })

// Copy files according to sync paths
const copyFiles = (inputs: ActionInputs, cloneDir: string) =>
  Effect.gen(function* () {
    const commandService = yield* CommandService
    
    for (const [source, destination] of inputs.syncPaths) {
      // Check if source exists
      if (!existsSync(source)) {
        core.warning(`Source path does not exist: ${source}`)
        continue
      }
      
      const destPath = join(cloneDir, destination)
      const destDir = dirname(destPath)
      
      // Create destination directory if it doesn't exist
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }
      
      // Copy the file or directory
      yield* commandService.execute(`cp -r "${source}" "${destPath}"`)
      
      core.info(`Copied ${source} -> ${destination}`)
    }
  })

// Check for changes and commit/push if needed
const commitAndPush = (cloneDir: string) =>
  Effect.gen(function* () {
    const commandService = yield* CommandService
    
    // Check if there are any changes
    const status = yield* commandService.execute("git status --porcelain", cloneDir)
    
    if (!status.trim()) {
      core.info("No changes detected, skipping commit and push")
      return ""
    }
    
    // Add all changes
    yield* commandService.execute("git add .", cloneDir)
    
    // Commit changes
    const commitMessage = "chore: Sync files from source repository"
    yield* commandService.execute(`git commit -m "${commitMessage}"`, cloneDir)
    
    // Push changes
    yield* commandService.execute("git push origin main", cloneDir)
    
    // Get the commit hash
    const commitHash = yield* commandService.execute("git rev-parse HEAD", cloneDir)
    
    core.info(`Successfully pushed changes with commit hash: ${commitHash}`)
    return commitHash
  })

// Main program
const program = Effect.gen(function* () {
  const inputs = yield* parseInputs
  
  core.info(`Starting sync to ${inputs.destinationRepo}`)
  core.info(`Sync paths: ${inputs.syncPaths.map(([s, d]) => `${s} -> ${d}`).join(", ")}`)
  
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
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
  
  core.info("Cross-repo sync completed successfully")
})

// Create the command service layer
const CommandServiceLive = Layer.succeed(
  CommandService,
  CommandService.of({
    execute: (command: string, cwd?: string) =>
      Effect.try({
        try: () => {
          const result = execSync(command, { 
            cwd, 
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]
          })
          return result.toString().trim()
        },
        catch: (error) => new Error(`Command failed: ${command}\n${String(error)}`)
      })
  })
)

// Run the program
pipe(
  program,
  Effect.provide(CommandServiceLive),
  Effect.runPromise
).catch((error: unknown) => {
  core.setFailed(`Action failed: ${String(error)}`)
  process.exit(1)
})