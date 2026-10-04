# Contributing to Arkive

Thank you for your interest in contributing to **Arkive**!

Arkive is an open-source project designed to deliver modern, reliable archive management and compression analysis for developers, systems engineers, and data engineers.

---

## Development Setup

### 1. Requirements
- **Rust Toolchain:** 1.70+ (`rustup default stable`)
- **C/C++ Toolchain:** MSVC C++ Build Tools or MinGW-w64 (GCC 12+)
- **Node.js:** v18 or later
- **npm / pnpm / yarn**

### 2. Repository Layout
- `crates/arkive-core`: The core archive library (zero UI dependencies).
- `crates/arkive-cli`: Command-line tool with progress bars and tables.
- `apps/desktop`: Desktop application built with Tauri v2 and React.
- `docs/`: In-depth documentation on benchmarks and codecs.

### 3. Running Tests
```bash
# Run core test suite
cargo test -p arkive-core

# Run specific format tests
cargo test -p arkive-core tests::every_codec_roundtrips
```

### 4. Running the Desktop App in Development
```bash
cd apps/desktop
npm install
npm run dev
```

---

## Code Guidelines
- Write clean, idiomatic Rust with clear error messages using `thiserror`.
- Ensure all path manipulation adheres to **Zip-Slip protection** principles (see `arkive_core::util::safe_join`).
- Keep UI components accessible, responsive, and styled with Tailwind CSS.
- Run `cargo fmt` and `cargo clippy` before opening a pull request.
