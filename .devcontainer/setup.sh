#!/usr/bin/env bash
set -euo pipefail

export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-/workspace/.venv-devcontainer}"

sudo apt-get update
sudo apt-get install --no-install-recommends -y \
    build-essential \
    clang \
    cmake \
    libayatana-appindicator3-dev \
    libclang-dev \
    librsvg2-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    patchelf \
    pkg-config
sudo rm -rf /var/lib/apt/lists/*

rustup target add wasm32-unknown-unknown

if ! command -v trunk >/dev/null 2>&1; then
    cargo install trunk --locked
fi
if ! command -v wasm-pack >/dev/null 2>&1; then
    cargo install wasm-pack --locked
fi
if ! command -v cargo-tauri >/dev/null 2>&1; then
    cargo install tauri-cli --version "^2.0" --locked
fi

BASHRC_LINE="source /app/.devcontainer/bashrc.override.sh"
if ! grep -Fqx "$BASHRC_LINE" "$HOME/.bashrc"; then
    printf '%s\n' "$BASHRC_LINE" >> "$HOME/.bashrc"
fi

cd /workspace
make setup
