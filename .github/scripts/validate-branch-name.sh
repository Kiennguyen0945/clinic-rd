#!/usr/bin/env bash
set -euo pipefail

branch_name="${1:-}"
branch_pattern='^(feat|fix|imp|docs|hotfix)/[a-z0-9]+(-[a-z0-9]+)*/cli-[1-9][0-9]*-[a-z0-9]+(-[a-z0-9]+)*$'

if [[ "$branch_name" =~ $branch_pattern ]]; then
  echo "Valid branch name: $branch_name"
  exit 0
fi

cat >&2 <<EOF
Invalid branch name: $branch_name

Expected format:
  <prefix>/<linear-user>/cli-<issue-number>-<lowercase-kebab-title>

Allowed prefixes:
  feat, fix, imp, docs, hotfix

Example:
  feat/nguyentrungkienhp202/cli-10-add-branch-name-check-in-pull-request
EOF
exit 1
