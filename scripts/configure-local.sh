#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

printf "BHRC Archives setup\n\n"
read -r -s -p "OpenAI API key (input is hidden): " openai_api_key
printf "\n"

if [[ -z "$openai_api_key" ]]; then
  printf "No API key was entered. Nothing was changed.\n" >&2
  exit 1
fi

read -r -p "Shared passcode (leave blank to generate one): " shared_passcode
if [[ -z "$shared_passcode" ]]; then
  shared_passcode="BHRC-$(openssl rand -hex 10)"
fi

umask 077
printf \
  "OPENAI_API_KEY=%s\nOPENAI_MODEL=gpt-5-mini\nSHARED_PASSCODE=%s\n" \
  "$openai_api_key" \
  "$shared_passcode" \
  > .dev.vars

printf "\nConfiguration saved securely.\n"
printf "Shared passcode: %s\n" "$shared_passcode"
printf "Keep this passcode for you and your boss.\n"
