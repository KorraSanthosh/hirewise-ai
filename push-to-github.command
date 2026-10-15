#!/bin/bash
# Pushes this project to https://github.com/KorraSanthosh/hirewise-ai
cd "$(dirname "$0")" || exit 1
[ -d .git ] || git init -b main
git add -A
echo "--- files that will be uploaded (large ones, if any) ---"
git ls-files -z | xargs -0 du -k 2>/dev/null | sort -rn | head -5
git status --short | grep -E "\.env$" && { echo "STOP: .env would be committed"; exit 1; }
git commit -m "HireWise AI: FastAPI + React hiring platform with role-wise ranking, candidate profiles and hackathon pipeline" || true
git remote remove origin 2>/dev/null
git remote add origin https://github.com/KorraSanthosh/hirewise-ai.git
git push -u origin main
read -p "Done. Press Enter to close"
