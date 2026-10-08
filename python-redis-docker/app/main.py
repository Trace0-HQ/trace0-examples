import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis.observability import MetricGroup, OTelConfig, get_observability_instance

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))

# redis-py exports its own native OTel metrics, but reuses the global MeterProvider rather
# than creating one — the opentelemetry-instrument wrapper (see Dockerfile) already sets that
# up from the OTEL_EXPORTER_OTLP_* env vars before this module is imported, so initializing
# here (before the client below) is all that's needed to start exporting Redis metrics.
otel = get_observability_instance()
otel.init(OTelConfig(
    metric_groups=[
        MetricGroup.COMMAND,
        MetricGroup.PUBSUB,
        MetricGroup.STREAMING,
        MetricGroup.CSC,
        MetricGroup.CONNECTION_BASIC,
        MetricGroup.CONNECTION_ADVANCED,
        MetricGroup.RESILIENCY,
    ]
))

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def wait_for_redis(retries: int = 20, delay_seconds: float = 1.0) -> None:
    # docker-compose's `depends_on` only waits for the redis *container* to start, not for
    # the Redis server inside it to finish booting and start accepting connections, so the
    # first ping here can easily lose that race.
    for attempt in range(1, retries + 1):
        try:
            redis_client.ping()
            return
        except redis.ConnectionError:
            if attempt == retries:
                raise
            logger.info(
                "Redis not ready yet (attempt %s/%s), retrying in %ss...",
                attempt, retries, delay_seconds,
            )
            time.sleep(delay_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_redis()
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


class UserRequest(BaseModel):
    name: str
    email: str


def user_key(user_id: str) -> str:
    return f"user:{user_id}"


@app.post("/users", status_code=201)
def create_user(body: UserRequest):
    if body.email == "trigger-error@example.com":
        raise Exception(f"Invalid email address: {body.email}.")

    user_id = str(uuid.uuid4())
    logger.info("Creating user with id %s", user_id)
    item = {
        "userId": user_id,
        "name": body.name,
        "email": body.email,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    redis_client.hset(user_key(user_id), mapping=item)
    logger.info("User %s created successfully", user_id)
    return item


@app.get("/users/{user_id}")
def load_user(user_id: str):
    logger.info("Loading user with id %s", user_id)
    item = redis_client.hgetall(user_key(user_id))
    if not item:
        logger.warning("User %s not found", user_id)
        raise HTTPException(status_code=404, detail="User not found")
    return item


@app.put("/users/{user_id}")
def edit_user(user_id: str, body: UserRequest):
    logger.info("Editing user with id %s", user_id)
    key = user_key(user_id)
    if not redis_client.exists(key):
        logger.warning("User %s not found", user_id)
        raise HTTPException(status_code=404, detail="User not found")

    # HSET only touches the fields given here — createdAt (set at creation) is left alone.
    redis_client.hset(key, mapping={
        "name": body.name,
        "email": body.email,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    })
    logger.info("User %s updated successfully", user_id)
    return redis_client.hgetall(key)


@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str):
    logger.info("Deleting user with id %s", user_id)
    deleted = redis_client.delete(user_key(user_id))
    if not deleted:
        logger.warning("User %s not found", user_id)
        raise HTTPException(status_code=404, detail="User not found")
    logger.info("User %s deleted successfully", user_id)
