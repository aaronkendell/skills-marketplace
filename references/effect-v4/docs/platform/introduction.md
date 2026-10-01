<!-- source: https://effect.website/docs/v4/platform/introduction/ · fetched 2026-10-01 -->

# Introduction to Effect Platform

The `effect` package includes platform modules for building platform-independent abstractions in environments such as Node.js, Deno, Bun, and browsers.

With these modules, you can integrate abstract services like [FileSystem](/docs/v4/platform/file-system/) or [Terminal](/docs/v4/platform/terminal/) into your program.
When assembling your final application, you can provide specific [layers](/docs/v4/requirements-management/layers/) for the target platform using the corresponding packages:

- `@effect/platform-node` for Node.js or Deno
- `@effect/platform-bun` for Bun
- `@effect/platform-browser` for browsers

### Stable Modules

The following modules are stable and their documentation is available on this website:

| Module                                              | Description                                                | Status                                    |
| --------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| [FileSystem](/docs/v4/platform/file-system/)        | A module for file system operations.                       | **Stable** |
| [Path](/docs/v4/platform/path/)                     | Utilities for working with file paths.                     | **Stable** |
| [PlatformLogger](/docs/v4/platform/platformlogger/) | Log messages to a file using the FileSystem APIs.          | **Stable** |
| [Runtime](/docs/v4/platform/runtime/)               | Run your program with built-in error handling and logging. | **Stable** |
| [Terminal](/docs/v4/platform/terminal/)             | Tools for terminal interaction.                            | **Stable** |

## Installation

The platform modules are included in the `effect` package, so no additional installation is required. See [Installation](/docs/v4/getting-started/installation/) for how to install `effect` itself.

Platform-specific packages such as `@effect/platform-node` are only needed to run your program on a concrete platform, as shown in the sections below.

## Getting Started with Cross-Platform Programming

Here's a basic example using the `Path` module to create a file path, which can run across different environments:

**Example** (Cross-Platform Path Handling)

```ts
import { Effect, Path } from "effect"

const program = Effect.gen(function* () {
  // Access the Path service
  const path = yield* Path.Path

  // Join parts of a path to create a complete file path
  const mypath = path.join("tmp", "file.txt")

  console.log(mypath)
  return mypath
})

Effect.runSync(program.pipe(Effect.provide(Path.layer))) // => "tmp/file.txt"
```

### Running the Program in Node.js or Deno

First, install the Node.js-specific package:

**npm**

```sh
npm install @effect/platform-node
```

**pnpm**

```sh
pnpm add @effect/platform-node
```

**Yarn**

```sh
yarn add @effect/platform-node
```

**Deno**

```sh
deno add npm:@effect/platform-node
```

Update the program to load the Node.js-specific context:

**Example** (Providing Node.js Context)

```ts
import { Effect, Path } from "effect"
import { NodeServices, NodeRuntime } from "@effect/platform-node"

const program = Effect.gen(function* () {
  // Access the Path service
  const path = yield* Path.Path

  // Join parts of a path to create a complete file path
  const mypath = path.join("tmp", "file.txt")

  console.log(mypath)
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
```

Finally, run the program in Node.js using `tsx`, or directly in Deno:

**npm**

```sh
npx tsx index.ts
# Output: tmp/file.txt
```

**pnpm**

```sh
pnpm dlx tsx index.ts
# Output: tmp/file.txt
```

**Yarn**

```sh
yarn dlx tsx index.ts
# Output: tmp/file.txt
```

**Deno**

```sh
deno run index.ts
# Output: tmp/file.txt

# or

deno run -RE index.ts
# Output: tmp/file.txt
# (granting required Read and Environment permissions without being prompted)
```

### Running the Program in Bun

To run the same program in Bun, first install the Bun-specific package:

```sh
bun add @effect/platform-bun
```

Update the program to use the Bun-specific context:

**Example** (Providing Bun Context)

```ts
import { Effect, Path } from "effect"
import { BunServices, BunRuntime } from "@effect/platform-bun"

const program = Effect.gen(function* () {
  // Access the Path service
  const path = yield* Path.Path

  // Join parts of a path to create a complete file path
  const mypath = path.join("tmp", "file.txt")

  console.log(mypath)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
```

Run the program in Bun:

```sh
bun index.ts
tmp/file.txt
```
