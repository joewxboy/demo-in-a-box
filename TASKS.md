# MCP Server Implementation Tasks

**Project:** demo-in-a-box MCP Server  
**Goal:** Create an MCP (Model Context Protocol) server to provision, manage, and inspect Open Horizon demo environments  
**Architecture:** Isolated environment directories + stdio transport  
**Estimated Effort:** 4-7 days for v1

---

## Architecture Overview

### Core Design Decisions
- **State Management:** Per-environment directories (`~/.demo-in-a-box/envs/<name>/`) with isolated `.vagrant/` state
- **Source of Truth:** `env.json` (desired) + `vagrant status --machine-readable` (observed) + `ops/*.json` (operation ledger)
- **Transport:** stdio (v1), HTTP/SSE (v2 future)
- **Async Strategy:** Long operations return `operation_id` for polling, short operations block
- **Concurrency:** File locks per environment + global concurrency limit

### Directory Structure
```
~/.demo-in-a-box/
├── envs/
│   ├── my-unicycle/
│   │   ├── env.json                    # Desired config
│   │   ├── env.lock                    # File lock
│   │   ├── hub/
│   │   │   ├── .vagrant/              # Isolated Vagrant state
│   │   │   ├── Vagrantfile.hub        # Symlink to repo
│   │   │   └── mycreds.env            # Generated credentials
│   │   ├── agents/
│   │   │   ├── .vagrant/
│   │   │   └── Vagrantfile.unicycle   # Generated
│   │   └── ops/
│   │       ├── op-abc123.json         # Operation status
│   │       └── op-abc123.log          # Operation logs
└── global.lock                         # Global concurrency control
```

---

## Phase 1: Core Infrastructure (1-2 days)

### Task 1.1: Project Setup
**Priority:** HIGH  
**Effort:** 2-4 hours

**Actions:**
- [ ] Create `mcp-server/` directory in repo root
- [ ] Initialize TypeScript project (`tsconfig.json`, `package.json`)
- [ ] Install dependencies:
  - `@modelcontextprotocol/sdk`
  - `zod` (schema validation)
  - `uuid` (operation IDs)
- [ ] Install dev dependencies:
  - `@types/node`
  - `vitest` (testing)
  - `tsx` (TypeScript execution)
- [ ] Create basic project structure:
  ```
  mcp-server/
  ├── src/
  │   ├── index.ts              # Entry point (stdio transport setup)
  │   ├── server.ts             # MCP server initialization
  │   ├── env/                  # Environment management
  │   ├── ops/                  # Operation management
  │   ├── vagrant/              # Vagrant integration
  │   ├── tools/                # MCP tool implementations
  │   └── types.ts              # Type definitions
  ├── tests/
  ├── package.json
  └── tsconfig.json
  ```
- [ ] Configure build scripts in `package.json`
- [ ] Add `.gitignore` for `node_modules/`, `dist/`

**Acceptance Criteria:**
- `npm run build` compiles TypeScript successfully
- `npm start` runs without errors (even if no-op)
- Project structure follows plan

**Files Created:**
- `mcp-server/package.json`
- `mcp-server/tsconfig.json`
- `mcp-server/src/index.ts`
- `mcp-server/src/server.ts`

---

### Task 1.2: Environment Manager Core
**Priority:** HIGH  
**Effort:** 4-6 hours

**Actions:**
- [ ] Create `src/env/manager.ts`
- [ ] Implement `EnvironmentManager` class:
  - `getEnvDir()` - Returns `~/.demo-in-a-box/envs/<name>/`
  - `createEnv(config)` - Creates directory structure, writes `env.json`
  - `listEnvs()` - Scans envs directory, returns metadata
  - `getEnv(name)` - Reads `env.json`, validates existence
  - `deleteEnv(name)` - Removes environment directory
- [ ] Create `src/env/types.ts`:
  - `EnvironmentConfig` type
  - `EnvironmentStatus` type
  - Zod schemas for validation
- [ ] Implement directory creation with error handling
- [ ] Symlink Makefile + configuration/ into each env's hub/agents dirs

**Acceptance Criteria:**
- Can create environment directory structure
- `env.json` is written with valid schema
- Symlinks to repo files work correctly
- List/get/delete operations work
- Errors handled gracefully (name conflicts, missing dirs)

**Files Created:**
- `mcp-server/src/env/manager.ts`
- `mcp-server/src/env/types.ts`
- `mcp-server/src/env/config.ts`

---

### Task 1.3: File Locking for Concurrency
**Priority:** HIGH  
**Effort:** 2-3 hours

**Actions:**
- [ ] Create `src/env/locks.ts`
- [ ] Implement file-based locking:
  - `acquireLock(envName)` - Creates/locks `env.lock` using `fs.promises` + flock pattern
  - `releaseLock(envName)` - Releases lock
  - `withLock(envName, fn)` - Executes function with lock held
- [ ] Implement global concurrency limit:
  - `acquireGlobalSlot()` - Max 2 concurrent vagrant operations
  - `releaseGlobalSlot()`
  - `withGlobalSlot(fn)` - Executes with global slot
- [ ] Add timeout handling (prevent deadlocks)
- [ ] Add proper cleanup on process exit

**Acceptance Criteria:**
- Concurrent operations on same env are serialized
- Global concurrency limit prevents >2 vagrant processes
- Locks released on error/exit
- No deadlocks with reasonable timeouts

**Files Created:**
- `mcp-server/src/env/locks.ts`

---

### Task 1.4: Command Execution Layer
**Priority:** HIGH  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `src/vagrant/executor.ts`
- [ ] Implement `CommandExecutor` class:
  - `executeCommand(cmd, args, opts)` - Spawns child process
  - Stream stdout/stderr to log file
  - Capture exit code
  - Timeout handling
- [ ] Define allowlisted commands:
  ```typescript
  const ALLOWED_COMMANDS = {
    make: ['init', 'up', 'up-hub', 'down', 'status', 'clean'],
    vagrant: ['status', 'ssh-config', 'port', 'halt', 'destroy', 'snapshot']
  };
  ```
- [ ] Validate commands against allowlist
- [ ] Set proper working directory and environment variables
- [ ] Handle SIGTERM/SIGINT gracefully

**Acceptance Criteria:**
- Can execute allowlisted make/vagrant commands
- Non-allowlisted commands rejected
- Output captured to logs
- Exit codes propagated
- Timeouts work correctly

**Files Created:**
- `mcp-server/src/vagrant/executor.ts`
- `mcp-server/src/vagrant/commands.ts`

---

### Task 1.5: Vagrant Integration & Parsing
**Priority:** HIGH  
**Effort:** 4-6 hours

**Actions:**
- [ ] Create `src/vagrant/parser.ts`
- [ ] Implement parsers for `vagrant status --machine-readable`:
  - Parse CSV format: `timestamp,target,type,data`
  - Extract machine states (running, stopped, not_created)
  - Extract provider info
- [ ] Implement parser for `vagrant ssh-config`:
  - Extract hostname, port, user, private key path
- [ ] Implement parser for `vagrant port`:
  - Extract guest→host port mappings
- [ ] Create `src/vagrant/status.ts`:
  - `getEnvironmentStatus(envName)` - Combines parsed data
  - Returns structured status object
- [ ] Add unit tests for parsers with sample outputs

**Acceptance Criteria:**
- Correctly parses `--machine-readable` output
- Extracts SSH config correctly
- Extracts port mappings correctly
- Handles edge cases (no VMs, partial provision)
- Unit tests pass

**Files Created:**
- `mcp-server/src/vagrant/parser.ts`
- `mcp-server/src/vagrant/status.ts`
- `mcp-server/tests/vagrant/parser.test.ts`

---

### Task 1.6: Operation Ledger
**Priority:** HIGH  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `src/ops/ledger.ts`
- [ ] Implement `OperationLedger` class:
  - `createOperation(envName, type)` - Returns operation ID, creates `ops/<id>.json`
  - `updateOperation(id, status, metadata)` - Updates status
  - `getOperation(id)` - Reads operation metadata
  - `listOperations(envName?)` - Lists operations, optionally filtered
- [ ] Create `src/ops/logger.ts`:
  - Stream logger that writes to `ops/<id>.log`
  - Implements line buffering
  - Handles rotation if needed
- [ ] Define operation states: `queued`, `running`, `succeeded`, `failed`, `cancelled`
- [ ] Store timestamps, exit codes, error summaries

**Acceptance Criteria:**
- Operations tracked in JSON files
- Logs written to separate files
- Can query operation status
- Can list operations by environment
- Atomic updates (no corruption)

**Files Created:**
- `mcp-server/src/ops/ledger.ts`
- `mcp-server/src/ops/logger.ts`
- `mcp-server/src/ops/types.ts`

---

## Phase 2: MCP Tools Implementation (2-3 days)

### Task 2.1: MCP Server Bootstrap
**Priority:** HIGH  
**Effort:** 2-3 hours

**Actions:**
- [ ] Complete `src/server.ts`:
  - Initialize `McpServer` with name/version
  - Set up stdio transport
  - Register all tools (stubs initially)
  - Handle initialization
  - Handle cleanup on exit
- [ ] Complete `src/index.ts`:
  - Connect server to transport
  - Set up signal handlers
  - Error handling

**Acceptance Criteria:**
- Server starts and connects via stdio
- Can be launched by MCP client
- Graceful shutdown works
- Logs initialization

**Files Modified:**
- `mcp-server/src/server.ts`
- `mcp-server/src/index.ts`

---

### Task 2.2: Tool #1 - env_create
**Priority:** HIGH  
**Effort:** 2-3 hours

**Actions:**
- [ ] Create `src/tools/env-create.ts`
- [ ] Implement tool handler:
  - Validate input with Zod schema
  - Check for name conflicts
  - Create environment via `EnvironmentManager`
  - Optionally trigger provision if `auto_provision=true`
  - Return environment metadata + operation_id (if provisioning)
- [ ] Register tool in `server.ts`
- [ ] Add integration test

**Input Schema:**
```typescript
{
  name: z.string().regex(/^[a-z0-9-]+$/),
  system_configuration: z.enum(["unicycle", "bicycle", "car", "semi"]),
  overrides?: {
    memory_mb?: number,
    disk_gb?: number,
    base_ip?: number,
    num_agents?: number
  },
  auto_provision?: boolean
}
```

**Acceptance Criteria:**
- Creates environment directory correctly
- Validates input (rejects invalid names)
- Detects name conflicts
- Returns structured response
- Auto-provision option works

**Files Created:**
- `mcp-server/src/tools/env-create.ts`

---

### Task 2.3: Tool #2 - env_list
**Priority:** HIGH  
**Effort:** 1-2 hours

**Actions:**
- [ ] Create `src/tools/env-list.ts`
- [ ] Implement tool handler:
  - Call `EnvironmentManager.listEnvs()`
  - Optionally filter by status
  - Return array of environment summaries
- [ ] Register tool in `server.ts`

**Acceptance Criteria:**
- Lists all environments
- Filter by status works
- Returns correct metadata
- Handles empty list gracefully

**Files Created:**
- `mcp-server/src/tools/env-list.ts`

---

### Task 2.4: Tool #3 - env_inspect
**Priority:** HIGH  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `src/tools/env-inspect.ts`
- [ ] Implement tool handler:
  - Read `env.json` (desired state)
  - Call `vagrant status --machine-readable` (observed state)
  - Parse port mappings
  - Parse SSH configs
  - Check for artifacts (mycreds.env, etc.)
  - Get last operation status
  - Combine into structured response
- [ ] Register tool in `server.ts`

**Output Structure:**
```typescript
{
  desired: { system_configuration, overrides, created_at },
  observed: {
    hub: { state, ip, ports: {3090, 3111, 9008, 9443} },
    agents: [{ name, state, ip }]
  },
  artifacts: { creds_present, ssh_keys_present },
  last_operation: { id, status, finished_at }
}
```

**Acceptance Criteria:**
- Returns complete environment state
- Observed state matches vagrant reality
- Port mappings correct
- IP addresses extracted
- Handles non-existent/partial environments

**Files Created:**
- `mcp-server/src/tools/env-inspect.ts`

---

### Task 2.5: Tool #4 - env_provision (Async)
**Priority:** HIGH  
**Effort:** 4-5 hours

**Actions:**
- [ ] Create `src/tools/env-provision.ts`
- [ ] Implement async tool handler:
  - Validate environment exists
  - Acquire lock + global slot
  - Create operation in ledger
  - Spawn `make init` in background
  - Stream output to operation log
  - Update operation status on completion/failure
  - Release lock + slot
  - Return operation_id immediately
- [ ] Implement background job execution
- [ ] Handle force_recreate option (run `make down` first)
- [ ] Add error recovery suggestions

**Acceptance Criteria:**
- Returns operation_id immediately
- Provision runs in background
- Logs captured to ops/<id>.log
- Operation status updates correctly
- Lock released on completion/error
- Can provision unicycle successfully (integration test)

**Files Created:**
- `mcp-server/src/tools/env-provision.ts`

---

### Task 2.6: Tool #5 - operation_status
**Priority:** HIGH  
**Effort:** 1-2 hours

**Actions:**
- [ ] Create `src/tools/operation-status.ts`
- [ ] Implement tool handler:
  - Read operation metadata from `ops/<id>.json`
  - Return structured status
  - Include next_actions on failure
- [ ] Register tool in `server.ts`

**Acceptance Criteria:**
- Returns operation status correctly
- Handles non-existent operations
- Provides helpful next_actions on failure

**Files Created:**
- `mcp-server/src/tools/operation-status.ts`

---

### Task 2.7: Tool #6 - operation_logs
**Priority:** HIGH  
**Effort:** 2-3 hours

**Actions:**
- [ ] Create `src/tools/operation-logs.ts`
- [ ] Implement tool handler:
  - Read log file from `ops/<id>.log`
  - Support offset/limit for pagination
  - Support tail mode (last N lines)
  - Return text + next_offset
- [ ] Handle large log files efficiently
- [ ] Register tool in `server.ts`

**Acceptance Criteria:**
- Returns log content correctly
- Pagination works (offset/limit)
- Tail mode works
- Handles large files without OOM
- Handles non-existent logs

**Files Created:**
- `mcp-server/src/tools/operation-logs.ts`

---

### Task 2.8: Tool #7 - env_ssh_info
**Priority:** HIGH  
**Effort:** 2-3 hours

**Actions:**
- [ ] Create `src/tools/env-ssh-info.ts`
- [ ] Implement tool handler:
  - Execute `vagrant ssh-config <target>` in appropriate subdir
  - Parse output
  - Generate connection command
  - Return structured SSH info
- [ ] Handle hub vs agent target selection
- [ ] Register tool in `server.ts`

**Acceptance Criteria:**
- Returns valid SSH config
- Connection command works (verified manually)
- Handles non-running VMs gracefully
- Target selection works correctly

**Files Created:**
- `mcp-server/src/tools/env-ssh-info.ts`

---

### Task 2.9: Tool #8 - env_exec
**Priority:** MEDIUM  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `src/tools/env-exec.ts`
- [ ] Implement tool handler:
  - Execute `vagrant ssh <target> -c "<command>"` in appropriate subdir
  - Capture stdout/stderr/exit_code
  - Implement timeout
  - Return structured result
- [ ] Sanitize command input (prevent injection)
- [ ] Register tool in `server.ts`

**Acceptance Criteria:**
- Executes commands on VMs successfully
- Captures output correctly
- Timeout works
- Prevents command injection
- Returns proper exit codes

**Files Created:**
- `mcp-server/src/tools/env-exec.ts`

---

### Task 2.10: Tool #9 - env_deprovision (Async)
**Priority:** HIGH  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `src/tools/env-deprovision.ts`
- [ ] Implement async tool handler:
  - Acquire lock + global slot
  - Create operation in ledger
  - Execute `make down` (if destroy=true) or `vagrant halt` (if false)
  - Stream output to log
  - Optionally cleanup files
  - Update operation status
  - Release lock + slot
  - Return operation_id
- [ ] Register tool in `server.ts`

**Acceptance Criteria:**
- Returns operation_id immediately
- Deprovision runs in background
- destroy vs halt works correctly
- cleanup_files option works
- Logs captured

**Files Created:**
- `mcp-server/src/tools/env-deprovision.ts`

---

## Phase 3: Testing & Refinement (1-2 days)

### Task 3.1: Unit Tests
**Priority:** HIGH  
**Effort:** 4-6 hours

**Actions:**
- [ ] Write tests for `vagrant/parser.ts`:
  - Test `--machine-readable` parsing with sample outputs
  - Test `ssh-config` parsing
  - Test `port` parsing
  - Test edge cases (no VMs, errors)
- [ ] Write tests for `env/manager.ts`:
  - Test environment creation
  - Test list/get/delete operations
  - Test validation
- [ ] Write tests for `ops/ledger.ts`:
  - Test operation creation/updates
  - Test querying operations
- [ ] Achieve >80% code coverage on core modules

**Acceptance Criteria:**
- All unit tests pass
- Code coverage >80%
- Edge cases covered

**Files Created:**
- `mcp-server/tests/vagrant/parser.test.ts`
- `mcp-server/tests/env/manager.test.ts`
- `mcp-server/tests/ops/ledger.test.ts`

---

### Task 3.2: Integration Tests
**Priority:** HIGH  
**Effort:** 4-6 hours

**Actions:**
- [ ] Create integration test suite:
  - Test full env_create → env_provision → env_inspect flow
  - Test env_list with multiple environments
  - Test env_exec on running VM
  - Test env_deprovision cleanup
- [ ] Add CI workflow (if applicable)
- [ ] Document test environment requirements

**Acceptance Criteria:**
- Can provision unicycle environment end-to-end
- Can execute commands on provisioned VMs
- Can deprovision cleanly
- Tests documented

**Files Created:**
- `mcp-server/tests/integration/provision.test.ts`

---

### Task 3.3: Error Recovery Scenarios
**Priority:** MEDIUM  
**Effort:** 3-4 hours

**Actions:**
- [ ] Test and document recovery from:
  - Provision failure mid-way (download errors)
  - VirtualBox errors
  - Disk space issues
  - Lock timeout scenarios
  - Interrupted operations (Ctrl+C)
- [ ] Implement recovery suggestions in error messages
- [ ] Add `env_repair` tool (optional) for forced cleanup

**Acceptance Criteria:**
- Error messages include next steps
- Can recover from common failure modes
- Locks released on crashes
- Documentation updated with troubleshooting guide

---

### Task 3.4: Documentation
**Priority:** HIGH  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `mcp-server/README.md`:
  - Architecture overview
  - Installation instructions
  - Usage examples
  - Tool reference (all 9 tools)
  - Configuration options
  - Troubleshooting guide
- [ ] Document environment directory structure
- [ ] Add inline code documentation (JSDoc)
- [ ] Create examples directory with sample usage

**Acceptance Criteria:**
- README is comprehensive
- All tools documented with examples
- Architecture clearly explained
- Troubleshooting guide complete

**Files Created:**
- `mcp-server/README.md`
- `mcp-server/ARCHITECTURE.md`
- `mcp-server/examples/`

---

## Phase 4: Advanced Features (Future)

### Task 4.1: Tool #10 - env_snapshot
**Priority:** LOW  
**Effort:** 3-4 hours

**Actions:**
- [ ] Create `src/tools/env-snapshot.ts`
- [ ] Implement snapshot operations:
  - list: `vagrant snapshot list`
  - save: `vagrant snapshot save`
  - restore: `vagrant snapshot restore`
  - delete: `vagrant snapshot delete`
- [ ] Support per-VM and all-VMs snapshots
- [ ] Make restore async (can take time)

**Files Created:**
- `mcp-server/src/tools/env-snapshot.ts`

---

### Task 4.2: Tool #11 - env_credentials
**Priority:** MEDIUM  
**Effort:** 1-2 hours

**Actions:**
- [ ] Create `src/tools/env-credentials.ts`
- [ ] Read mycreds.env
- [ ] Parse HZN_ORG_ID and HZN_EXCHANGE_USER_AUTH
- [ ] Redact by default, show on explicit opt-in
- [ ] Add security warning in output

**Files Created:**
- `mcp-server/src/tools/env-credentials.ts`

---

### Task 4.3: Health Monitoring
**Priority:** LOW  
**Effort:** 4-6 hours

**Actions:**
- [ ] Implement health checks in `env_inspect`:
  - Execute `hzn version` on agents
  - Execute `hzn node list` on agents
  - Execute `hzn ex user ls` on agents
  - Check service reachability (ports)
- [ ] Add `include_health_checks` option to env_inspect
- [ ] Cache health check results (TTL)

---

### Task 4.4: HTTP/SSE Transport
**Priority:** LOW  
**Effort:** 1-2 days

**Actions:**
- [ ] Implement HTTP/SSE transport in addition to stdio
- [ ] Add session management
- [ ] Support concurrent clients
- [ ] Add authentication (optional)
- [ ] Document deployment as service

---

## Security Checklist

- [ ] Input validation on all tool inputs (Zod schemas)
- [ ] Environment name regex prevents path traversal
- [ ] Command allowlist prevents arbitrary execution
- [ ] Credentials redacted in logs by default
- [ ] Credentials redacted in error messages
- [ ] File locks prevent race conditions
- [ ] Global concurrency limit enforced
- [ ] Timeouts on all operations
- [ ] Proper cleanup on exit/crash

---

## Success Criteria (v1 Complete)

- [ ] Can create and list environments
- [ ] Can provision unicycle environment (async, 30 min)
- [ ] Can inspect environment status with IP/port info
- [ ] Can execute non-interactive commands on VMs
- [ ] Can retrieve SSH connection details
- [ ] Can deprovision and cleanup environments
- [ ] Operation logs accessible and useful
- [ ] Error recovery works (retry provision, forced destroy)
- [ ] No credential leakage in logs/errors
- [ ] Concurrency safe (file locks working)
- [ ] Documentation complete
- [ ] Unit + integration tests passing

---

## Technology Stack

**Runtime:** Node.js 18+  
**Language:** TypeScript 5+  
**Dependencies:**
- `@modelcontextprotocol/sdk` (MCP protocol)
- `zod` (schema validation)
- `uuid` (operation IDs)

**Dev Dependencies:**
- `@types/node`
- `vitest` (testing)
- `tsx` (TypeScript execution)

---

## Development Workflow

1. **Start new task:**
   - Update task status in this file
   - Create git branch: `mcp-server/<task-name>`

2. **During development:**
   - Follow TypeScript best practices
   - Add tests for new code
   - Update documentation

3. **Complete task:**
   - Check acceptance criteria
   - Run tests: `npm test`
   - Run linter: `npm run lint`
   - Commit with clear message
   - Check off task in this file

4. **Integration:**
   - Merge to main after review
   - Tag milestones (Phase 1 complete, etc.)

---

## Notes

- **Focus on Phase 1 & 2 first** - Core functionality before advanced features
- **Use `--machine-readable` everywhere** - Don't parse human output
- **Test with unicycle first** - Smallest configuration for fast iteration
- **Keep state simple** - Files over DB until proven necessary
- **Document as you go** - Don't leave docs for end
- **Security first** - Validate all inputs, allowlist all commands

---

**Last Updated:** 2026-01-31  
**Status:** Planning Complete, Ready for Implementation
