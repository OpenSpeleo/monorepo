#!/usr/bin/env bash
set -euo pipefail

readonly CONTAINER_PREFIX="${COMPOSE_INSTANCE_PREFIX:-speleodb_devcontainer}"
readonly WORKSPACE_CONTAINER="${CONTAINER_PREFIX}_local_django"
readonly WEBSERVER_CONTAINER="${CONTAINER_PREFIX}_local_django_webserver"
readonly SETUP_CONTAINER="${CONTAINER_PREFIX}_local_setup"
readonly HEALTH_TIMEOUT_SECONDS="${DEVCONTAINER_HEALTH_TIMEOUT_SECONDS:-1200}"
readonly POLL_INTERVAL_SECONDS=2
readonly INFRASTRUCTURE_CONTAINERS=(
    "${CONTAINER_PREFIX}_local_postgres"
    "${CONTAINER_PREFIX}_local_redis"
    "${CONTAINER_PREFIX}_gitlab_lab"
    "${CONTAINER_PREFIX}_rustfs"
)

container_exists() {
    docker container inspect "$1" >/dev/null 2>&1
}

wait_until_healthy() {
    local container="$1"
    local elapsed=0
    local status

    while ((elapsed < HEALTH_TIMEOUT_SECONDS)); do
        status="$(
            docker container inspect \
                --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
                "${container}"
        )"
        case "${status}" in
            healthy | running)
                return 0
                ;;
            unhealthy | dead | exited)
                printf '%s entered terminal state %s during devcontainer restart\n' \
                    "${container}" "${status}" >&2
                return 1
                ;;
        esac
        sleep "${POLL_INTERVAL_SECONDS}"
        elapsed=$((elapsed + POLL_INTERVAL_SECONDS))
    done

    printf 'Timed out waiting for %s to become healthy\n' "${container}" >&2
    return 1
}

# No existing workspace means this is the initial creation. The devcontainer
# implementation will create every service declared by runServices.
if ! container_exists "${WORKSPACE_CONTAINER}"; then
    exit 0
fi

for container in \
    "${INFRASTRUCTURE_CONTAINERS[@]}" \
    "${SETUP_CONTAINER}" \
    "${WEBSERVER_CONTAINER}"; do
    if ! container_exists "${container}"; then
        printf 'Existing devcontainer stack is incomplete: %s is missing\n' \
            "${container}" >&2
        exit 1
    fi
done

printf 'Restarting devcontainer infrastructure services...\n'
docker restart "${INFRASTRUCTURE_CONTAINERS[@]}" >/dev/null
for container in "${INFRASTRUCTURE_CONTAINERS[@]}"; do
    wait_until_healthy "${container}"
done

printf 'Rerunning completed devcontainer setup...\n'
docker restart "${SETUP_CONTAINER}" >/dev/null
readonly setup_exit_code="$(docker wait "${SETUP_CONTAINER}")"
if [[ "${setup_exit_code}" != "0" ]]; then
    printf 'Devcontainer setup failed with exit code %s\n' \
        "${setup_exit_code}" >&2
    exit "${setup_exit_code}"
fi

printf 'Restarting devcontainer workspace and webserver...\n'
docker restart "${WORKSPACE_CONTAINER}" >/dev/null
docker restart "${WEBSERVER_CONTAINER}" >/dev/null
