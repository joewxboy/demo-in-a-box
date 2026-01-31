# MCP Server Architecture

## Overview

The demo-in-a-box MCP server is a TypeScript application that implements the Model Context Protocol to manage Open Horizon demo environments via Vagrant + VirtualBox.

## Core Components

### 1. Server Layer (`src/server.ts`, `src/index.ts`)

**Responsibilities:**
- Initialize MCP Server with stdio transport
- Register all 9 tools with the MCP SDK
- Handle ListTools and CallTool requests
- Route tool invocations to appropriate handlers
- Error handling and graceful shutdown

**Key Design Decisions:**
- Uses stdio transport for local process integration
- Single server instance per process
- Tools registered statically at startup
- Errors wrapped in standardized JSON responses

### 2. Environment Management (`src/env/`)

**Files:**
- `manager.ts` - EnvironmentManager class for CRUD operations
- `config.ts` - Configuration constants and defaults
- `types.ts` - Zod schemas for validation
- `locks.ts` - LockManager for concurrency control

**Responsibilities:**
- Create isolated environment directories
- Manage environment configuration (env.json)
- Symlink Makefile and configuration files
- List, retrieve, and delete environments
- Enforce naming conventions (lowercase, numbers, hyphens)

**State Management:**
- Each environment has own directory: `~/.demo-in-a-box/envs/<name>/`
- Desired state stored in `env.json`
- Observed state queried via vagrant commands
- No database - filesystem is source of truth

### 3. Concurrency Control (`src/env/locks.ts`)

**Mechanisms:**
- **Per-Environment Locks:** File-based locks (`env.lock`) prevent concurrent operations on same environment
- **Global Slot Limit:** Maximum 2 vagrant operations across all environments (resource constraint)

**Implementation:**
- Exclusive file creation (`wx` flag) for atomic locking
- 30-second timeout to prevent deadlocks
- Lock release on process exit (SIGINT/SIGTERM handlers)
- Queue system for global slots with FIFO ordering

**Why This Matters:**
- Vagrant operations are resource-intensive (CPU, I/O, network)
- Concurrent operations on same environment cause corruption
- Global limit prevents system overload

### 4. Command Execution (`src/vagrant/`)

**Files:**
- `executor.ts` - CommandExecutor for safe command invocation
- `commands.ts` - Allowlisted make/vagrant commands
- `parser.ts` - Parse vagrant machine-readable output
- `status.ts` - StatusChecker combines parsed data

**Security:**
- **Allowlist Approach:** Only specific make/vagrant commands permitted
- **No Shell Injection:** Commands validated before execution
- **Sanitization:** User input sanitized (backticks, dollar signs removed)
- **Timeouts:** All commands have configurable timeouts

**Vagrant Integration:**
- Uses `--machine-readable` flag for parseable output
- Parses CSV format: `timestamp,target,type,data`
- Extracts VM states, SSH configs, port mappings
- Handles errors gracefully (non-existent VMs, etc.)

### 5. Operation Tracking (`src/ops/`)

**Files:**
- `ledger.ts` - OperationLedger for operation metadata
- `logger.ts` - OperationLogger for streaming logs
- `types.ts` - Operation schemas

**Operation Lifecycle:**
```
queued → running → succeeded/failed
```

**Storage:**
- Metadata: `ops/op-<uuid>.json` (status, timestamps, exit codes)
- Logs: `ops/op-<uuid>.log` (streaming output from commands)

**Why Separate Files:**
- Enables pagination of large log files
- Allows atomic metadata updates
- Easy to implement log rotation if needed

### 6. Tool Implementations (`src/tools/`)

Each tool is a standalone handler function:
- Input validation with Zod schemas
- Instantiate required managers/executors
- Perform operation
- Return standardized JSON response

**Tool Categories:**
- **Sync Tools:** env_create, env_list, env_inspect, env_ssh_info, env_exec
- **Async Tools:** env_provision, env_deprovision (return operation_id)
- **Query Tools:** operation_status, operation_logs

## Data Flow

### Environment Creation

```
User → env_create
  ↓
Validate input (Zod)
  ↓
Check name conflicts
  ↓
Create directory structure
  ↓
Create symlinks to repo files
  ↓
Write env.json
  ↓
Return metadata
```

### Async Provisioning

```
User → env_provision
  ↓
Acquire env lock
  ↓
Acquire global slot
  ↓
Create operation (ledger)
  ↓
Spawn background task
  │  ↓
  │ Update status: running
  │  ↓
  │ Execute make init
  │  ↓
  │ Stream logs to file
  │  ↓
  │ Update status: succeeded/failed
  │  ↓
  │ Release lock & slot
  ↓
Return operation_id immediately
```

### Status Inspection

```
User → env_inspect
  ↓
Read env.json (desired state)
  ↓
Execute vagrant status --machine-readable
  ↓
Parse output (hub + agents)
  ↓
Extract IP addresses
  ↓
Check for artifacts (mycreds.env)
  ↓
Combine into EnvironmentStatus
  ↓
Return JSON
```

## Key Design Patterns

### 1. Isolated State Per Environment

Each environment is completely isolated:
- Own `.vagrant/` directories
- Own operation logs
- Own lock files
- No shared state between environments

**Benefits:**
- Can run multiple environments on same host
- No cross-environment interference
- Easy to backup/restore individual environments

### 2. Symlinks for Code Reuse

Instead of copying files:
- Symlink `Makefile` into each environment
- Symlink `configuration/` directory
- Generate Vagrantfiles from ERB template

**Benefits:**
- Updates to repo files immediately available
- No version drift between environments
- Minimal disk space usage

### 3. Async Operations with Polling

Long operations (provision, deprovision):
- Return operation_id immediately
- Execute in background
- User polls with operation_status/operation_logs

**Benefits:**
- MCP client doesn't timeout
- User can monitor progress
- Logs available in real-time
- Can check status after disconnect/reconnect

### 4. File-Based Concurrency

Using filesystem for locks:
- No external dependencies (Redis, etc.)
- Works in single-host scenarios
- Survives process crashes (can detect stale locks)

**Limitations:**
- Not suitable for distributed systems
- Requires filesystem support for atomic operations

## Error Handling Strategy

### Validation Errors

- Caught at tool handler entry
- Zod provides detailed error messages
- Return structured error response

### Operation Failures

- Captured in operation metadata
- Exit codes preserved
- Error summaries provided
- Logs contain full details

### Recovery Mechanisms

- **Lock Timeouts:** Prevent indefinite hangs
- **Graceful Shutdown:** Release all locks on exit
- **Idempotent Operations:** Can retry safely
- **Force Recreate:** Clean slate for stuck provisions

## Performance Considerations

### Bottlenecks

1. **Vagrant Operations:** 30-60 minutes for full provision
2. **VirtualBox:** CPU and I/O intensive
3. **Network:** Download Ubuntu images and packages
4. **Disk:** 20GB+ per agent VM

### Optimizations

- **Global Slot Limit:** Prevents system overload
- **Parallel Agent Provisioning:** Vagrant `--parallel` flag
- **Streaming Logs:** Don't buffer entire output
- **Pagination:** Efficient log retrieval

## Testing Strategy

### Unit Tests

- **Parser Tests:** Validate parsing of vagrant output formats
- **Manager Tests:** CRUD operations on environments
- **Ledger Tests:** Operation lifecycle and log handling

### Integration Tests

- Not included in v1 (require actual Vagrant/VirtualBox)
- Would test full provision flow end-to-end
- Expensive to run (30+ minutes per test)

### Manual Testing

- Test each tool with Claude Desktop or MCP client
- Verify async operations complete successfully
- Test error recovery scenarios

## Future Enhancements (Phase 4)

### HTTP/SSE Transport

- Enable remote access to MCP server
- Server-Sent Events for real-time log streaming
- Session management and authentication

### Snapshot Management

- Create/restore VM snapshots
- Checkpoint before risky operations
- Quick rollback on failures

### Health Checks

- Periodic polling of service status
- Execute `hzn version`, `hzn node list`
- Alert on service failures

### Credential Management

- Secure storage of mycreds.env
- Rotate credentials on demand
- Redact in logs by default (already done)

## Dependencies

### Runtime

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Schema validation and type inference
- `uuid` - Generate operation IDs

### External Tools

- **vagrant** - VM orchestration
- **VirtualBox** - Virtualization provider
- **make** - Build orchestration
- **erb** - Template generation (Ruby)

### Development

- `typescript` - Type checking and compilation
- `vitest` - Unit testing framework
- `tsx` - TypeScript execution for development
