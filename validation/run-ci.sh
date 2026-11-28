#!/usr/bin/env bash
set -euo pipefail

validation_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$validation_dir/.." && pwd)"
artifacts_dir="${VALIDATION_ARTIFACTS:-"$repo_root/validation-artifacts"}"
mkdir -p "$artifacts_dir"
artifacts_dir="$(cd "$artifacts_dir" && pwd)"
work_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/sabaii-validation.XXXXXX")"
base_commit=d6450219503b8c97877b726d23f845f0d39f1baf
candidate_commit="$(git -C "$repo_root" rev-parse HEAD)"
status="$artifacts_dir/checks.tsv"
failures=0
scope="${SABAII_VALIDATION_SCOPE:-all}"

run_check() {
  local name="$1" code
  shift
  printf 'Running %s\n' "$name"
  if ( "$@" ) > "$artifacts_dir/$name.log" 2>&1; then
    printf '%s\t0\n' "$name" >> "$status"
    return 0
  else
    code=$?
    printf '%s\t%s\n' "$name" "$code" >> "$status"
    tail -n 24 "$artifacts_dir/$name.log" >&2
    failures=$((failures + 1))
    return 1
  fi
}

prepare_snapshots() {
  printf 'Base: %s\nCandidate: %s\n' "$base_commit" "$candidate_commit"
  git -C "$repo_root" merge-base --is-ancestor "$base_commit" "$candidate_commit" || return
  test "$base_commit" != "$candidate_commit" || return
  mkdir -p "$work_dir/"{before,after,deps} || return
  git -C "$repo_root" archive "$base_commit" | tar -xf - -C "$work_dir/before" || return
  git -C "$repo_root" archive "$candidate_commit" | tar -xf - -C "$work_dir/after" || return
  git -C "$repo_root" diff --check "$base_commit" "$candidate_commit" || return
  git -C "$repo_root" diff --stat "$base_commit" "$candidate_commit"
}

record_environment() {
  uname -a
  node --version
  npm --version
  cat /etc/os-release
  grep -m1 'model name' /proc/cpuinfo || :
  printf 'Base: %s\nCandidate: %s\n' "$base_commit" "$candidate_commit"
  sha256sum "$validation_dir/benchmark.cjs" "$validation_dir/bench-local.mjs"
}

node_suite() {
  cd "$1" || return
  timeout 180s node --test --test-isolation=none tests/*.test.mjs
}

build_snapshot() {
  cd "$1" || return
  sh scripts/build-site.sh || return
  test -f dist/app/index.html && test -f dist/app/sw.js
}

install_browser() {
  cd "$work_dir/deps" || return
  npm install --no-save --no-audit --no-fund playwright@1.62.1 || return
  npx playwright --version || return
  npx playwright install --with-deps chromium
}

printf 'check\texit_code\n' > "$status"
run_check prepare-snapshots prepare_snapshots
run_check environment record_environment || :
if [[ "$scope" == all || "$scope" == regression ]]; then
  for variant in before after; do
    run_check "$variant-node" node_suite "$work_dir/$variant" || :
  done
  if run_check local-benchmark node "$validation_dir/bench-local.mjs" "$work_dir/before" "$work_dir/after"; then
    cp "$artifacts_dir/local-benchmark.log" "$artifacts_dir/local-benchmark.json"
  fi
fi
build_ok=1
for variant in before after; do
  if ! run_check "$variant-build" build_snapshot "$work_dir/$variant"; then
    build_ok=0
  fi
done

if run_check install-chromium install_browser; then
  export NODE_PATH="$work_dir/deps/node_modules"
  if [[ "$scope" == all || "$scope" == regression ]]; then
    for variant in before after; do
      for suite in e2e account.e2e sketch.e2e canva.e2e shell.e2e shell-ride.e2e notify.e2e; do
        run_check "$variant-$suite" timeout 180s node "$work_dir/$variant/tests/$suite.cjs" || :
      done
    done
  fi
  if [[ "$scope" != regression ]]; then
    if [[ "$build_ok" == 1 ]]; then
      run_check browser-benchmark timeout 25m node "$validation_dir/benchmark.cjs" \
        "$work_dir/before/dist/app" "$work_dir/after/dist/app" "$artifacts_dir" || :
    else
      printf 'browser-benchmark\tskipped (snapshot build failed)\n' >> "$status"
    fi
  fi
else
  printf 'e2e and browser-benchmark\tskipped (Chromium install failed)\n' >> "$status"
fi

cat "$status"
if [[ -f "$artifacts_dir/benchmark-summary.json" ]]; then
  printf 'BENCHMARK_SUMMARY '
  node -p 'JSON.stringify(require(process.argv[1]))' "$artifacts_dir/benchmark-summary.json"
fi
if [[ -f "$artifacts_dir/benchmark-errors.json" ]]; then
  node -e '
    const errors = require(process.argv[1]);
    const failed = errors.trials.filter(row => !row.ok);
    console.log("BENCHMARK_FAILURES " + JSON.stringify({
      fatal: errors.fatal,
      failed: failed.length,
      examples: failed.slice(0, 4)
    }));
  ' "$artifacts_dir/benchmark-errors.json"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '## SABAii performance validation\n\n'
    sed 's/^/    /' "$status"
    if [[ -f "$artifacts_dir/benchmark-summary.md" ]]; then
      printf '\n'
      cat "$artifacts_dir/benchmark-summary.md"
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

if (( failures > 0 )); then exit 1; fi
