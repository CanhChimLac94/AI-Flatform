PROJECT_ROOT=/mnt/d/01.WORKS/WWW/AI-Projects/AIChat
cd $PROJECT_ROOT

clear-all() {
    cd $PROJECT_ROOT/infrastructure && docker compose down
    docker rmi $(docker images -aq)
    # clear all volumes
    docker volume rm $(docker volume ls -q)
    docker system prune -a -f # clear all containers
}

all() {
    # stop all docker containers and images and remove all volumes, images, and containers
    clear-all
    cd $PROJECT_ROOT && ./scripts/deploy.sh
}

rebuild-contaner() {
    docker compose -f infrastructure/docker-compose.yml build $1 && docker compose -f infrastructure/docker-compose.yml up -d $1
}

# rebuild frontend
frontend() {
    # docker compose -f infrastructure/docker-compose.yml build frontend && docker compose -f infrastructure/docker-compose.yml up -d frontend
    rebuild-contaner frontend
}

# rebuild backend
backend() {
    # docker compose -f infrastructure/docker-compose.yml build backend && docker compose -f infrastructure/docker-compose.yml up -d backend
    rebuild-contaner backend
}

"$@"
