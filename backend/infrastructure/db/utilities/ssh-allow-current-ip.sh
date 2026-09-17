#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# SSH Allow-List Updater — Idempotent, IP-Drift Helper
# ============================================================================
# Restricts the Lightsail port-22 firewall to the current admin machine's
# public IP. Same flow staging+prod. NEVER widens 22 to 0.0.0.0/0.
#
# Why: public IPs change. After an IP drift, the old allow-list silently
# denies SSH. This helper detects the new IP, read-modify-writes the
# instance firewall so port 22 keeps allowing this admin machine, and
# optionally opens an interactive SSH session afterwards.
#
# Usage:
#   ./ssh-allow-current-ip.sh --stage <staging|prod>
#                             [--ip 1.2.3.4]            (default: auto-detect via checkip.amazonaws.com)
#                             [--port 22]                (default: 22)
#                             [--no-ssh]                 (update firewall only, do not connect)
#                             [--dry-run]                (print actions, do not call put-instance-public-ports)
#                             [--region us-east-1]       (default: us-east-1)
#                             [--profile disruptive]
#
# Safety rules:
#   - Refuses to widen port 22 to 0.0.0.0/0 (would silently expose SSH to
#     the whole internet).
#   - If the current allow-list is empty (no cidrs), aborts — never auto-
#     adds 0.0.0.0/0.
#   - Always preserves every existing cidr; only adds the current IP if
#     missing. If you need to revoke a stale IP, edit by hand.
#   - Idempotent: a second run with the same IP is a no-op.
# ============================================================================

STAGE=""
REGION="us-east-1"
PROFILE=""
PORT=22
ALLOW_IP=""
NO_SSH=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat <<EOF
Usage: $0 --stage <staging|prod> [OPTIONS]

Update the Lightsail firewall for port <PORT> to also allow the current
admin machine's public IP. Same flow for staging and prod.

Options:
  --stage STAGE      Environment stage (staging or prod) — REQUIRED
  --ip IP            Override auto-detected public IP (must be IPv4 /32)
  --port PORT        TCP port to update (default: 22)
  --no-ssh           Update firewall only, do not open an SSH session
  --dry-run          Print what would change, do not call AWS
  --region REGION    AWS region (default: us-east-1)
  --profile PROFILE  AWS CLI profile (default: environment default)
  --help             Show this help
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)    STAGE="$2";    shift 2 ;;
        --region)   REGION="$2";   shift 2 ;;
        --profile)  PROFILE="$2";  shift 2 ;;
        --port)     PORT="$2";     shift 2 ;;
        --ip)       ALLOW_IP="$2"; shift 2 ;;
        --no-ssh)   NO_SSH=true;   shift ;;
        --dry-run)  DRY_RUN=true;  shift ;;
        --help)     usage ;;
        *) log_error "Unknown argument: $1"; usage ;;
    esac
done

if [[ "$STAGE" != "staging" && "$STAGE" != "prod" ]]; then
    log_error "--stage must be 'staging' or 'prod'"
    usage
fi

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

PROJECT_NAME="miempresa"
INSTANCE_NAME="${PROJECT_NAME}-backend-${STAGE}"

# ============================================================================
# 1. Resolve the admin machine's public IP
# ============================================================================
if [ -z "$ALLOW_IP" ]; then
    log_info "Detecting current public IP via https://checkip.amazonaws.com..."
    DETECTED_IP=$(curl --silent --max-time 10 https://checkip.amazonaws.com || echo "")
    if [ -z "$DETECTED_IP" ]; then
        log_error "Could not auto-detect public IP. Pass --ip 1.2.3.4 explicitly."
        exit 1
    fi
    ALLOW_IP="$DETECTED_IP"
    log_info "  Detected: ${ALLOW_IP}"
fi

# Validate the IP looks like IPv4 (no /32 suffix, no scheme prefix).
if [[ ! "$ALLOW_IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    log_error "Refusing to use '${ALLOW_IP}' — must be a bare IPv4 address (no /32, no scheme)."
    exit 1
fi

CIDR="${ALLOW_IP}/32"

# ============================================================================
# 2. Locate the instance and read its current port state
# ============================================================================
log_info "Reading current port states for ${INSTANCE_NAME} in ${REGION}..."

ALL_PORT_STATES=$("${AWS[@]}" lightsail get-instance-port-states \
    --instance-name "${INSTANCE_NAME}" \
    --region "${REGION}" \
    --query 'portStates' \
    --output json 2>/dev/null || echo "[]")

if [ "$ALL_PORT_STATES" == "[]" ] || [ -z "$ALL_PORT_STATES" ]; then
    log_error "Could not read port states for ${INSTANCE_NAME}."
    exit 1
fi

# Extract only the cidrs for the port we're updating (target port).
EXISTING_CIDRS_RAW=$(echo "$ALL_PORT_STATES" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for p in data:
        if p.get('fromPort') == ${PORT} and p.get('toPort') == ${PORT} and p.get('protocol') == 'tcp':
            for c in p.get('cidrs', []) or []:
                print(c)
            sys.exit(0)
    sys.exit(0)
except Exception:
    sys.exit(0)
")
EXISTING_CIDRS=()
while IFS= read -r line; do
    [ -n "$line" ] && EXISTING_CIDRS+=("$line")
done <<< "$EXISTING_CIDRS_RAW"

# Safety check: the target port must currently be open. If not, refuse — never
# auto-open a port that wasn't open before.
if [ "${#EXISTING_CIDRS[@]}" -eq 0 ] && ! echo "$ALL_PORT_STATES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for p in data:
    if p.get('fromPort') == ${PORT} and p.get('toPort') == ${PORT}:
        sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
    log_error "Port ${PORT}/tcp is not currently open on ${INSTANCE_NAME}."
    log_error "Refusing to auto-open it — the port may have been closed intentionally."
    log_error "Open it via create-instance.sh (firewall section) and re-run this helper."
    exit 1
fi

# Snapshot ALL OTHER port states — we must preserve them in the writeback
# (Lightsail put-instance-public-ports REPLACES the entire port state; the
# helper must NOT erase other ports like 3001/CloudFront origin).
OTHER_PORTS_JSON=$(echo "$ALL_PORT_STATES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
out = []
for p in data:
    if not (p.get('fromPort') == ${PORT} and p.get('toPort') == ${PORT} and p.get('protocol') == 'tcp'):
        out.append({
            'fromPort': p['fromPort'],
            'toPort': p['toPort'],
            'protocol': p['protocol'],
            'cidrs': p.get('cidrs', []) or [],
        })
print(json.dumps(out))
")

log_info "  Current port ${PORT}/tcp cidrs:"
for c in "${EXISTING_CIDRS[@]}"; do
    echo "    - ${c}"
done

# ============================================================================
# 3. Safety guards
# ============================================================================
HAS_WILDCARD=false
for c in "${EXISTING_CIDRS[@]}"; do
    if [ "$c" == "0.0.0.0/0" ]; then
        HAS_WILDCARD=true
        break
    fi
done

if $HAS_WILDCARD; then
    log_warn "Current allow-list contains 0.0.0.0/0 (SSH is open to the entire internet)."
    log_warn "This helper will NOT widen — it only adds the admin IP and preserves the wildcard."
    log_warn "Removing the wildcard is a manual operation; do it with intent."
fi

# Idempotency: if the admin IP is already in the list, no-op.
for c in "${EXISTING_CIDRS[@]}"; do
    if [ "$c" == "$CIDR" ]; then
        log_info "Admin IP ${ALLOW_IP} is already allowed on port ${PORT}/tcp. No change needed."
        if ! $NO_SSH; then
            log_info "Opening SSH to ${INSTANCE_NAME}..."
            exec "${SCRIPT_DIR}/ssh-to-instance.sh" "${INSTANCE_NAME}" "${REGION}"
        fi
        exit 0
    fi
done

# Refuse to add 0.0.0.0/0 if no cidrs exist.
if [ "${#EXISTING_CIDRS[@]}" -eq 0 ]; then
    log_error "Existing allow-list is empty. Refusing to add 0.0.0.0/0 (would expose port to world)."
    log_error "Re-open the port with a sane cidr first via create-instance.sh / AWS console."
    exit 1
fi

# ============================================================================
# 4. Compose the new port-infos payload
# ============================================================================
# Lightsail rejects mixing 0.0.0.0/0 with specific cidrs. Strategy:
#   - If 0.0.0.0/0 is present: REMOVE it (closes the hole) + add the admin IP.
#   - Otherwise: keep every existing specific cidr + add the admin IP.
# Always preserves explicit cidrs the operator set by hand.
NEW_CIDRS=()
for c in "${EXISTING_CIDRS[@]}"; do
    if [ "$c" != "0.0.0.0/0" ]; then
        NEW_CIDRS+=("$c")
    fi
done
NEW_CIDRS+=("$CIDR")

# Build the JSON payload. The ListOtherPorts snapshot (OTHER_PORTS_JSON) is
# merged in so port 3001 / CloudFront origin (and any other port) survives
# the writeback. CRITICAL bug from staging apply 2026-09-17 — putting only
# port 22 erased every other port. Do not regress.
PORT_INFOS_PAYLOAD=$(jq -n \
    --argjson fromPort "$PORT" \
    --argjson toPort "$PORT" \
    --argjson cidrs "$(printf '%s\n' "${NEW_CIDRS[@]}" | jq -R . | jq -s .)" \
    --argjson otherPorts "$OTHER_PORTS_JSON" \
    '{portInfos: ([{fromPort: $fromPort, toPort: $toPort, protocol: "tcp", cidrs: $cidrs}] + $otherPorts)}')

log_info "Planned port ${PORT}/tcp cidrs after update:"
for c in "${NEW_CIDRS[@]}"; do
    echo "    - ${c}"
done

if $DRY_RUN; then
    log_info "[DRY-RUN] Skipping put-instance-public-ports call."
    exit 0
fi

# ============================================================================
# 5. Apply the firewall update
# ============================================================================
log_info "Applying firewall update to ${INSTANCE_NAME}..."

"${AWS[@]}" lightsail put-instance-public-ports \
    --instance-name "${INSTANCE_NAME}" \
    --cli-input-json "${PORT_INFOS_PAYLOAD}" \
    --region "${REGION}" > /dev/null

log_info "✓ Port ${PORT}/tcp on ${INSTANCE_NAME} now allows: ${NEW_CIDRS[*]}"

# ============================================================================
# 6. Optional SSH
# ============================================================================
if ! $NO_SSH; then
    log_info "Opening SSH to ${INSTANCE_NAME}..."
    exec "${SCRIPT_DIR}/ssh-to-instance.sh" "${INSTANCE_NAME}" "${REGION}"
fi