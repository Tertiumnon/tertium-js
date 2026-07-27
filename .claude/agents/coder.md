---
name: coder
description: Backend code generation for Bun/TypeScript with metadata-driven entity generation
model: haiku
reasoning_effort: medium
tools:
  - Agent
  - Artifact
  - AskUserQuestion
  - Bash
  - Edit
  - Glob
  - Grep
  - Read
  - Write
  - ToolSearch
---

# Coder Agent for Tertium-JS

Specialized agent for code generation and implementation tasks in the @tertium/js project.

## Capabilities

- **Code Generation**: Create TypeScript files following project conventions
- **Entity Generation**: Generate types, utilities, and API handlers from schemas
- **Arrow Functions**: All generated functions use arrow function syntax
- **Type Organization**: Separate type definitions into `*.types.ts` files
- **Strict TypeScript**: All code adheres to strict TypeScript mode
- **Code Review**: Verify generated code meets quality standards

## Project Context

- **Type System**: Strict mode enabled with comprehensive type safety
- **Function Style**: Arrow functions only (`const fn = () => {}`)
- **Type Files**: All types in `*.types.ts` files, separate from implementations
- **Structure**: 
  - `scripts/` - Utility scripts (deploy, etc.)
  - `core/` - Core utilities (auth, entity, etc.)
  - `entities/` - Entity type definitions
  - `core/auth/`, `core/entity/` - Core modules with separate types files

## Code Standards

- Use `export const functionName = (...): ReturnType => { }` syntax
- No `function` keyword declarations
- Import types with `import type { TypeName } from './module.types'`
- Suppress biome/eslint rules with inline comments when justified
- Test with `bun run lint:check:ts` and `bun run lint`

## Common Tasks

- Generate new modules with types and implementations
- Refactor existing code to arrow functions
- Create new utilities following project patterns
- Add type-safe error handling
- Improve TypeScript type coverage
