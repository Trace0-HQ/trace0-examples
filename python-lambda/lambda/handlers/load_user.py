import json
import logging
import os

import boto3

logger = logging.getLogger(__name__)

dynamo = boto3.resource('dynamodb')
TABLE_NAME = os.environ['USERS_TABLE_NAME']


def load_user(event: dict) -> dict:
    user_id = (event.get('pathParameters') or {}).get('userId')
    if not user_id:
        return _json(400, {'error': 'userId path parameter is required'})

    logger.info(f"Loading user with id: {user_id}")

    try:
        result = dynamo.Table(TABLE_NAME).get_item(Key={'userId': user_id})
    except Exception:
        logger.error('Failed to load user', exc_info=True)
        return _json(500, {'error': 'Internal server error'})

    item = result.get('Item')
    if not item:
        logger.error(f"User not found with id: {user_id}.")
        return _json(404, {'error': 'User not found'})

    logger.info(f"User loaded successfully with id: {user_id}.")
    return _json(200, item)


def _json(status_code: int, body: object) -> dict:
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body),
    }
