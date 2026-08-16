#!/usr/bin/env bash
set -euo pipefail

manifest=${1:?Usage: read-release-manifest.sh <manifest> [github-output-file]}
output_file=${2:-}

if [[ ! -f "$manifest" ]]; then
  echo "Release manifest not found: $manifest" >&2
  exit 1
fi

declare -A values=()
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  case "$key" in
    FRONTEND_TAG|BACKEND_TAG|REPORTING_TAG)
      values["$key"]=$value
      ;;
    *)
      echo "Unsupported key in release manifest: $key" >&2
      exit 1
      ;;
  esac
done < "$manifest"

for key in FRONTEND_TAG BACKEND_TAG REPORTING_TAG; do
  value=${values[$key]:-}
  if [[ ! "$value" =~ ^[0-9a-f]{40}$ ]]; then
    echo "$key must be a full 40-character lowercase Git SHA" >&2
    exit 1
  fi
done

if [[ -n "$output_file" ]]; then
  {
    echo "frontend_tag=${values[FRONTEND_TAG]}"
    echo "backend_tag=${values[BACKEND_TAG]}"
    echo "reporting_tag=${values[REPORTING_TAG]}"
  } >> "$output_file"
else
  printf 'FRONTEND_TAG=%s\n' "${values[FRONTEND_TAG]}"
  printf 'BACKEND_TAG=%s\n' "${values[BACKEND_TAG]}"
  printf 'REPORTING_TAG=%s\n' "${values[REPORTING_TAG]}"
fi
