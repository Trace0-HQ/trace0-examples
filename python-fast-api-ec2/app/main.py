import logging
import os
import uuid

import boto3
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


TABLE_NAME = os.environ["USERS_TABLE_NAME"]
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "eu-west-1"))
table = dynamodb.Table(TABLE_NAME)


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
