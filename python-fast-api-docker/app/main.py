import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TABLE_NAME = os.environ["USERS_TABLE_NAME"]

dynamodb_kwargs = {"region_name": os.environ.get("AWS_REGION", "local")}
dynamodb_endpoint = os.environ.get("DYNAMODB_ENDPOINT")
if dynamodb_endpoint:
    # DynamoDB Local doesn't validate credentials, but boto3 still needs a
    # credentials provider to resolve successfully before it'll make requests.
    dynamodb_kwargs.update(
        endpoint_url=dynamodb_endpoint,
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )

dynamodb = boto3.resource("dynamodb", **dynamodb_kwargs)
table = dynamodb.Table(TABLE_NAME)


def ensure_table_exists(retries: int = 20, delay_seconds: float = 1.0) -> None:
    # docker-compose's `depends_on` only waits for the dynamodb-local *container*
    # to start, not for its JVM to actually finish booting and start listening on
    # port 8000, so the first attempt here can easily lose that race.
    for attempt in range(1, retries + 1):
        try:
            dynamodb.create_table(
                TableName=TABLE_NAME,
                AttributeDefinitions=[{"AttributeName": "userId", "AttributeType": "S"}],
                KeySchema=[{"AttributeName": "userId", "KeyType": "HASH"}],
                BillingMode="PAY_PER_REQUEST",
            )
            logger.info("Created table %s", TABLE_NAME)
            return
        except ClientError as err:
            if err.response["Error"]["Code"] == "ResourceInUseException":
                return
            raise
        except EndpointConnectionError:
            if attempt == retries:
                raise
            logger.info(
                "DynamoDB Local not ready yet (attempt %s/%s), retrying in %ss...",
                attempt, retries, delay_seconds,
            )
            time.sleep(delay_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_table_exists()
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


class CreateUserRequest(BaseModel):
    name: str
    email: str


@app.post("/users", status_code=201)
def create_user(body: CreateUserRequest):
    user_id = str(uuid.uuid4())
    logger.info("Creating user with id %s", user_id)
    item = {"userId": user_id, "name": body.name, "email": body.email}
    table.put_item(Item=item)
    logger.info("User %s created successfully", user_id)
    return item


@app.get("/users/{user_id}")
def load_user(user_id: str):
    logger.info("Loading user with id %s", user_id)
    response = table.get_item(Key={"userId": user_id})
    item = response.get("Item")
    if not item:
        logger.warning("User %s not found", user_id)
        raise HTTPException(status_code=404, detail="User not found")
    return item
