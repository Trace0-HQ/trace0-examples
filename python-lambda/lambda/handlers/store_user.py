import json
import logging
import os
import random
import string
import time
from datetime import datetime, timezone

import boto3

logger = logging.getLogger(__name__)

dynamo = boto3.resource('dynamodb')
TABLE_NAME = os.environ['USERS_TABLE_NAME']


def _generate_user_id() -> str:
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"usr_{int(time.time() * 1000)}_{suffix}"


def store_user(event: dict) -> dict:
    if not event.get('body'):
        return _json(400, {'error': 'Request body is required'})

    try:
        body = json.loads(event['body'])
    except (json.JSONDecodeError, TypeError):
        return _json(400, {'error': 'Invalid JSON body'})

    name = body.get('name')
    email = body.get('email')
    if not name or not email:
        return _json(400, {'error': 'name and email are required'})

    user_id = _generate_user_id()
    user = {
        'userId': user_id,
        'name': name,
        'email': email,
        'createdAt': datetime.now(timezone.utc).isoformat(),
    }

    logger.info(f"Storing user with id: {user_id}.")

    dynamo.Table(TABLE_NAME).put_item(Item=user)

    logger.info(f"User stored successfully with id: {user_id}")
    return _json(201, user)


def _json(status_code: int, body: object) -> dict:
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body),
    }
