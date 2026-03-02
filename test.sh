#!/bin/bash
docker compose down -v --remove-orphans
docker compose up -d web db
sleep 15
DURATION=10 docker compose --profile attacker up -d --scale attacker-ratelimit=5 attacker-ratelimit
sleep 15
docker compose stop
docker compose logs web | grep "\[LOG\]" | wc -l
