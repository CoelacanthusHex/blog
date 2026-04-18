#!/bin/sh
# run-if-changed.sh <stamp> <input> <cmd> [args...]
# Runs <cmd> [args...] and updates <stamp> only if <input> content changed.
# Uses BLAKE2 (b2sum) for fast content hashing.
# Usage in Ninja rules: run-if-changed.sh $out $in <tool> [tool-args...]
set -e
stamp="$1"; input="$2"; shift 2
before=$(b2sum "$input" | cut -d' ' -f1)
"$@"
after=$(b2sum "$input" | cut -d' ' -f1)
if [ "$after" != "$before" ] || [ ! -f "$stamp" ]; then
  touch "$stamp"
fi
