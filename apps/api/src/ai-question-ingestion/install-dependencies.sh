#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== TrivioQ Ingestion System Dependency Installer ==="
echo "Installing GraphicsMagick and Ghostscript..."

# Detect OS/Package Manager
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
fi

case "$OS" in
    ubuntu|debian|raspbian)
        echo "Detected Debian-based system ($OS). Using apt-get..."
        sudo apt-get update
        sudo apt-get install -y graphicsmagick ghostscript
        ;;
    centos|rhel|rocky|almalinux|amzn)
        echo "Detected RedHat-based system ($OS). Using dnf/yum..."
        if command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y epel-release || true
            sudo dnf install -y GraphicsMagick ghostscript
        else
            sudo yum install -y epel-release || true
            sudo yum install -y GraphicsMagick ghostscript
        fi
        ;;
    alpine)
        echo "Detected Alpine Linux. Using apk..."
        apk update
        apk add --no-cache graphicsmagick ghostscript
        ;;
    darwin)
        echo "Detected macOS. Using Homebrew..."
        if command -v brew >/dev/null 2>&1; then
            brew install graphicsmagick ghostscript
        else
            echo "Error: Homebrew is not installed. Please install Homebrew or install GraphicsMagick/Ghostscript manually."
            exit 1
        fi
        ;;
    *)
        echo "Unsupported OS: $OS"
        echo "Please install GraphicsMagick and Ghostscript manually using your system package manager."
        exit 1
        ;;
esac

# Verification
echo "=== Verifying Installations ==="

if command -v gm >/dev/null 2>&1; then
    echo "✅ GraphicsMagick (gm) is installed: $(gm -version | head -n 1)"
else
    echo "❌ GraphicsMagick (gm) is NOT installed or not in PATH."
    exit 1
fi

if command -v gs >/dev/null 2>&1; then
    echo "✅ Ghostscript (gs) is installed: $(gs --version)"
else
    echo "❌ Ghostscript (gs) is NOT installed or not in PATH."
    exit 1
fi

echo "=== Dependency Installation Completed Successfully! ==="
