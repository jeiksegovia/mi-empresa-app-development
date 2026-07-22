#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# STAGING S3 Uploads Wipe Utility (instrumentos-dynamic-fichas jul-17 release)
# ============================================================================
# Deletes ALL objects from a STAGING uploads bucket as part of a gated staging
# hard-reset release. The dynamic-fichas release removes the file-based ficha
# flow (plantillaArchivo / archivoCompletado), so stale uploaded objects are
# orphaned and must be wiped in lockstep with the DB hard reset.
#
# ----------------------------------------------------------------------------
# SAFETY MODEL — read before running (mirrors reset-staging-db.sh):
#   * STAGING ONLY. Hard-refuses any bucket that does not match
#       ^miempresa-[a-z0-9-]+-staging$
#     AND hard-refuses anything whose name contains "prod" (belt and braces).
#     (The assignment spelled this ^miempresa-[a-z-]+-staging$; that rejects the
#      real bucket miempresa-uploads-540657241795-staging, whose middle segment
#      carries the 12-digit account id — so digits are permitted. The staging-
#      only intent is unchanged: name must start miempresa- and end -staging.)
#     There is NO override flag for these refusals — by design. Do not add one.
#   * DEVELOPER-ONLY, MANUAL-ONLY. NEVER call this from cron, CI, a deploy
#     hook, or application code. With --execute it REQUIRES an interactive TTY
#     and two typed confirmations, so it CANNOT run unattended. There is no
#     env-var or piped-stdin bypass.
#   * DRY-RUN BY DEFAULT. Without --execute it only inspects (object count,
#     total size, 20-object sample) and exits 0. --execute ALONE is still not
#     enough to delete — the typed confirmations must also pass.
#   * Per the project prod-safety rule, a prod equivalent of this script must
#     NEVER exist. If you find yourself pointing this at a prod bucket, STOP.
#
# What it does with --execute (after confirmations pass):
#   1. Writes a full pre-wipe object manifest (aws s3 ls --recursive) to the
#      backups bucket under pre-releases/s3-manifests/<bucket>-<timestamp>.txt
#   2. Deletes every object: aws s3 rm s3://<bucket> --recursive
#   3. Verifies the bucket is empty (object count = 0) and logs verbatim.
#
# Versioning note: if the bucket has versioning ENABLED, `aws s3 rm --recursive`
# leaves delete markers + noncurrent versions behind (objects still billable,
# still recoverable). This utility does NOT purge versions. If a full version
# purge is ever required, it must be an explicit, separately-approved runbook
# step (delete-objects with VersionId enumeration). R0 of the runbook checks
# versioning status and records it.
#
# Usage:
#   ./wipe-staging-s3.sh --bucket miempresa-uploads-540657241795-staging            # dry-run
#   ./wipe-staging-s3.sh --bucket miempresa-uploads-540657241795-staging --execute  # destructive (TTY + typed confirm)
#
# Optional env:
#   BACKUP_BUCKET   S3 bucket for the pre-wipe manifest
#                   (default: miempresa-backups-540657241795-staging)
#   AWS_PROFILE_ARG defaults to "disruptive"; AWS_REGION defaults to us-east-1.
# ============================================================================

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE_ARG="${AWS_PROFILE_ARG:-disruptive}"
BACKUP_BUCKET="${BACKUP_BUCKET:-miempresa-backups-540657241795-staging}"
CONFIRM_PHRASE="WIPE-STAGING-S3"
TS="$(date +%Y%m%d-%H%M%S)"

BUCKET=""
EXECUTE=0

# ── Colors (loud red warning; degrade gracefully when not a TTY) ────────────
if [ -t 1 ]; then
  RED="\033[1;31m"; YEL="\033[1;33m"; NC="\033[0m"
else
  RED=""; YEL=""; NC=""
fi

log() { echo "[$(date +%H:%M:%S)] $*"; }

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '1,50p'
  exit "${1:-0}"
}

# ── Parse args ──────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --bucket)  BUCKET="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --help|-h) usage 0 ;;
    *) echo "REFUSED: unknown argument: $1" >&2; exit 2 ;;
  esac
done

AWS=(aws --profile "$AWS_PROFILE_ARG" --region "$AWS_REGION")

# ── Guard 1: bucket must be provided ────────────────────────────────────────
if [ -z "$BUCKET" ]; then
  echo "REFUSED: --bucket <name> is required." >&2
  exit 1
fi

# ── Guard 2: hard-refuse anything smelling like prod (belt) ─────────────────
case "$BUCKET" in
  *prod*)
    echo "REFUSED: bucket '$BUCKET' contains 'prod'. This utility is staging-only." >&2
    exit 1
    ;;
esac
case "$BACKUP_BUCKET" in
  *prod*)
    echo "REFUSED: BACKUP_BUCKET '$BACKUP_BUCKET' contains 'prod'. Refusing." >&2
    exit 1
    ;;
esac

# ── Guard 3: bucket MUST match the staging naming contract (braces) ─────────
if ! printf '%s' "$BUCKET" | grep -Eq '^miempresa-[a-z0-9-]+-staging$'; then
  echo "REFUSED: bucket '$BUCKET' does not match ^miempresa-[a-z0-9-]+-staging$" >&2
  echo "         This utility only ever operates on staging uploads buckets." >&2
  exit 1
fi

# ── Guard 4: bucket must actually exist / be reachable ──────────────────────
if ! "${AWS[@]}" s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "REFUSED: bucket '$BUCKET' not reachable (head-bucket failed). Check name/creds/region." >&2
  exit 1
fi

# ── Inspect: count, size, versioning, sample (always, dry-run and execute) ──
log "Inspecting s3://${BUCKET} ..."
SUMMARY="$("${AWS[@]}" s3 ls "s3://${BUCKET}" --recursive --summarize 2>/dev/null | tail -3 || true)"
OBJ_COUNT="$(printf '%s\n' "$SUMMARY" | awk -F': ' '/Total Objects/ {gsub(/ /,"",$2); print $2}')"
TOTAL_SIZE="$(printf '%s\n' "$SUMMARY" | awk -F': ' '/Total Size/ {print $2}')"
OBJ_COUNT="${OBJ_COUNT:-0}"
VERSIONING="$("${AWS[@]}" s3api get-bucket-versioning --bucket "$BUCKET" --query 'Status' --output text 2>/dev/null || echo 'None')"
[ "$VERSIONING" = "None" ] || [ -n "$VERSIONING" ] || VERSIONING="Disabled"

echo "=========================================="
echo "STAGING S3 WIPE — target inspection"
echo "=========================================="
echo "Bucket        : s3://${BUCKET}"
echo "Region        : ${AWS_REGION}   Profile: ${AWS_PROFILE_ARG}"
echo "Object count  : ${OBJ_COUNT}"
echo "Total size    : ${TOTAL_SIZE:-0 Bytes}"
echo "Versioning    : ${VERSIONING}"
echo "Manifest dest : s3://${BACKUP_BUCKET}/pre-releases/s3-manifests/${BUCKET}-${TS}.txt"
echo ""
echo "Sample (up to 20 objects):"
"${AWS[@]}" s3 ls "s3://${BUCKET}" --recursive 2>/dev/null | head -20 || true
echo ""

if [ "$VERSIONING" = "Enabled" ]; then
  echo -e "${YEL}NOTE: versioning is ENABLED — 'aws s3 rm --recursive' leaves delete markers +"
  echo -e "      noncurrent versions. This utility does NOT purge versions (see header).${NC}"
  echo ""
fi

# ── Dry-run stops here ──────────────────────────────────────────────────────
if [ "$EXECUTE" -ne 1 ]; then
  log "DRY-RUN complete (no --execute). Nothing was deleted."
  exit 0
fi

# ── Guard 5: --execute REQUIRES an interactive TTY (no unattended runs) ─────
if [ ! -t 0 ]; then
  echo "REFUSED: --execute requires an interactive TTY (stdin is not a terminal)." >&2
  echo "         This is DEVELOPER-ONLY, MANUAL-ONLY. No pipe / cron / CI bypass." >&2
  exit 1
fi

# ── Loud red warning + two typed confirmations ──────────────────────────────
echo -e "${RED}"
echo "############################################################################"
echo "#  DESTRUCTIVE ACTION — wipes ALL ${OBJ_COUNT} objects in"
echo "#     s3://${BUCKET}"
echo "#  NEVER run this without the developer's express intention."
echo "#  This is irreversible for non-versioned buckets."
echo "############################################################################"
echo -e "${NC}"

printf "Type the exact bucket name to continue: "
read -r TYPED_BUCKET
if [ "$TYPED_BUCKET" != "$BUCKET" ]; then
  echo "Aborted (bucket name mismatch: got '${TYPED_BUCKET}')."
  exit 1
fi

printf "Type the phrase '%s' to confirm the wipe: " "$CONFIRM_PHRASE"
read -r TYPED_PHRASE
if [ "$TYPED_PHRASE" != "$CONFIRM_PHRASE" ]; then
  echo "Aborted (confirmation phrase mismatch)."
  exit 1
fi

echo ""
log "Confirmations accepted. Proceeding with pre-wipe manifest + wipe."

# ── 1. Pre-wipe manifest → backups bucket ───────────────────────────────────
MANIFEST_LOCAL="/tmp/s3-manifest-${BUCKET}-${TS}.txt"
MANIFEST_KEY="pre-releases/s3-manifests/${BUCKET}-${TS}.txt"
log "[1/3] Writing pre-wipe manifest to ${MANIFEST_LOCAL} ..."
{
  echo "# Pre-wipe manifest for s3://${BUCKET}"
  echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Object count (pre-wipe): ${OBJ_COUNT}   Total size: ${TOTAL_SIZE:-0 Bytes}"
  echo "# Versioning: ${VERSIONING}"
  echo "# ---"
  "${AWS[@]}" s3 ls "s3://${BUCKET}" --recursive 2>/dev/null || true
} > "$MANIFEST_LOCAL"
"${AWS[@]}" s3 cp "$MANIFEST_LOCAL" "s3://${BACKUP_BUCKET}/${MANIFEST_KEY}"
log "      Manifest uploaded → s3://${BACKUP_BUCKET}/${MANIFEST_KEY}"

# ── 2. Wipe ─────────────────────────────────────────────────────────────────
log "[2/3] Deleting ALL objects in s3://${BUCKET} ..."
"${AWS[@]}" s3 rm "s3://${BUCKET}" --recursive

# ── 3. Post-wipe verification ───────────────────────────────────────────────
log "[3/3] Verifying bucket is empty ..."
POST_SUMMARY="$("${AWS[@]}" s3 ls "s3://${BUCKET}" --recursive --summarize 2>/dev/null | tail -3 || true)"
POST_COUNT="$(printf '%s\n' "$POST_SUMMARY" | awk -F': ' '/Total Objects/ {gsub(/ /,"",$2); print $2}')"
POST_COUNT="${POST_COUNT:-0}"

echo ""
echo "=========================================="
echo "STAGING S3 WIPE — result"
echo "=========================================="
echo "Bucket             : s3://${BUCKET}"
echo "Objects before     : ${OBJ_COUNT}"
echo "Objects after      : ${POST_COUNT}"
echo "Manifest           : s3://${BACKUP_BUCKET}/${MANIFEST_KEY}"
echo "Versioning         : ${VERSIONING}"
if [ "$POST_COUNT" != "0" ]; then
  echo -e "${YEL}WARNING: object count is ${POST_COUNT}, expected 0."
  if [ "$VERSIONING" = "Enabled" ]; then
    echo "         Bucket is versioned — 'ls --recursive' shows current versions only;"
    echo "         if this is >0, new writes landed during the wipe. Investigate."
  fi
  echo -e "${NC}"
  exit 1
fi
log "Wipe complete: s3://${BUCKET} is empty ($(date))."
rm -f "$MANIFEST_LOCAL"
