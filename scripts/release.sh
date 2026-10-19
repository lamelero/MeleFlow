#!/usr/bin/env bash
#
# MeleFlow - release helper (manual, single-arch linux/amd64)
#
# Usage:
#   scripts/release.sh <version>          # bump + commit + tag (dry-run, nothing published)
#   scripts/release.sh <version> --push   # ...and build/push images + push git
#
# Examples:
#   scripts/release.sh 1.3.0
#   scripts/release.sh 1.3.0 --push
#
# Env overrides:
#   DOCKER_USER   Docker Hub namespace        (default: meleflow)
#   PLATFORM      Target platform             (default: linux/amd64)
#   MAIN_BRANCH   Branch to release from      (default: main)
#
# Safety model:
#   * Refuses to run unless on MAIN_BRANCH, with a clean tree, in sync with origin.
#   * Refuses to reuse an existing tag.
#   * Without --push it stops after committing + tagging, so you can inspect/undo
#     (git tag -d vX.Y.Z && git reset --hard HEAD~1).
#   * Images are built from a clean `git archive` of HEAD, so only committed code
#     ever ships (and no node_modules gets sent as build context).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DOCKER_USER="${DOCKER_USER:-meleflow}"
PLATFORM="${PLATFORM:-linux/amd64}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"

IMAGES=(meleflow-backend meleflow-frontend)
CONTEXTS=(backend frontend)

die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }
ok()   { echo "OK: $*"; }

usage() {
  sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# -- args --------------------------------------------------------------------
VERSION="${1:-}"
if [ "$VERSION" = "-h" ] || [ "$VERSION" = "--help" ]; then
  usage
  exit 0
fi
[ $# -gt 0 ] && shift || true

PUSH=false
while [ $# -gt 0 ]; do
  case "$1" in
    --push) PUSH=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1" ;;
  esac
done

# -- 1. validations ----------------------------------------------------------
[ -n "$VERSION" ] || die "uso: scripts/release.sh <version> [--push]  (ej: 1.3.0)"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version invalida '$VERSION' (se espera SemVer X.Y.Z)"
[ "$VERSION" != "0.0.0" ] || die "version placeholder no permitida"

info "Validando repositorio"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "no estas en un repositorio git"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "$MAIN_BRANCH" ] || die "debes estar en '$MAIN_BRANCH' (rama actual: '$BRANCH')"

[ -z "$(git status --porcelain)" ] || die "el arbol de trabajo no esta limpio; haz commit o stash primero"

TAG="v$VERSION"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  die "el tag '$TAG' ya existe"
fi

if git rev-parse -q --verify "refs/remotes/origin/$MAIN_BRANCH" >/dev/null; then
  # Must contain the last fetched origin/<main> (being ahead is fine: that is the
  # normal state right after merging, before pushing).
  git merge-base --is-ancestor "origin/$MAIN_BRANCH" HEAD \
    || die "'$MAIN_BRANCH' no contiene 'origin/$MAIN_BRANCH' (estas por detras o divergida; haz pull primero)"
fi
ok "rama='$MAIN_BRANCH' arbol limpio tag='$TAG'"

# -- 2. bump version ---------------------------------------------------------
# package.json is the fallback source for local/native builds; the Docker image
# gets the version via the APP_VERSION build-arg. Keep both in sync.
info "Bump de version a $VERSION"
for dir in frontend backend; do
  ( cd "$dir" && npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null )
  ok "$dir/package.json -> $VERSION"
done

git add frontend/package.json backend/package.json
if [ -f frontend/package-lock.json ]; then git add frontend/package-lock.json; fi
if [ -f backend/package-lock.json ]; then git add backend/package-lock.json; fi

git commit -m "chore(release): $VERSION"
ok "commit: chore(release): $VERSION"

# -- 3. tag ------------------------------------------------------------------
info "Creando tag anotado $TAG"
git tag -a "$TAG" -m "MeleFlow $TAG"
ok "tag: $TAG"

if [ "$PUSH" != true ]; then
  echo
  info "Dry-run completado (sin --push). Nada publicado."
  echo "     Revisar:  git show --stat HEAD ; git show $TAG"
  echo "     Anular:   git tag -d $TAG && git reset --hard HEAD~1"
  echo "     Publicar: scripts/release.sh $VERSION --push"
  exit 0
fi

# -- 4. build images from a clean tree --------------------------------------
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/meleflow-build-XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT

info "Exportando arbol limpio (git archive HEAD) a $BUILD_DIR"
git archive HEAD | tar -x -C "$BUILD_DIR"

info "Construyendo imagenes (platform=$PLATFORM, APP_VERSION=$VERSION)"
for i in "${!IMAGES[@]}"; do
  img="${IMAGES[$i]}"; ctx="${CONTEXTS[$i]}"
  echo "     -> $DOCKER_USER/$img:$VERSION (+ :latest)"
  docker build \
    --platform "$PLATFORM" \
    --build-arg "APP_VERSION=$VERSION" \
    -f "$BUILD_DIR/$ctx/Dockerfile" \
    -t "$DOCKER_USER/$img:$VERSION" \
    -t "$DOCKER_USER/$img:latest" \
    "$BUILD_DIR"
done
ok "imagenes construidas"

# -- 5. publish --------------------------------------------------------------
info "Publicando imagenes en Docker Hub"
for img in "${IMAGES[@]}"; do
  docker push "$DOCKER_USER/$img:$VERSION"
  docker push "$DOCKER_USER/$img:latest"
done

info "Publicando git ($MAIN_BRANCH + tags)"
git push origin "$MAIN_BRANCH" --follow-tags

echo
ok "Release $TAG publicada"
