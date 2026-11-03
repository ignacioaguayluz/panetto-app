#!/bin/zsh
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
app_dir="$project_dir/build/Panetto.app"
sdk_path="/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk"
module_cache="$project_dir/build/module-cache"

rm -rf "$app_dir"
mkdir -p "$app_dir/Contents/MacOS" "$module_cache"
swiftc "$project_dir/Sources/PanettoApp.swift" \
  -parse-as-library \
  -sdk "$sdk_path" \
  -module-cache-path "$module_cache" \
  -framework SwiftUI \
  -framework AppKit \
  -o "$app_dir/Contents/MacOS/Panetto"
cp "$project_dir/Resources/Info.plist" "$app_dir/Contents/Info.plist"
codesign --force --sign - "$app_dir" >/dev/null

echo "Panetto listo: $app_dir"
