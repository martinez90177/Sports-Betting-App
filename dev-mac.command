#!/bin/bash
# The macOS launcher. Double-click it in Finder.
#
# ".command", not ".sh", and not by preference: uploading this folder failed
# with "Couldn't upload Sports Betting App/dev-mac.sh (.sh files aren't
# supported)". The extension is the only thing that was wrong -- the script is
# unchanged -- and .command is in fact the better macOS idiom, since Finder
# runs a .command in Terminal on double-click and merely opens a .sh in an
# editor. Do not rename it back.
#
# The Windows twin is dev.cmd. Neither is referenced by package.json, vercel or
# vite; they exist only to put node on PATH for a double-click launch, which is
# why plain "npm run dev" cannot replace them -- without node on PATH there is
# no npm to run.
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev
