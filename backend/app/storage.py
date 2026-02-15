import uuid

import boto3
from botocore.config import Config as BotoConfig

from app.config import settings

_client = None

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/json",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/gzip",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if settings.minio_use_ssl else 'http'}://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=BotoConfig(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _client


def ensure_bucket() -> None:
    client = _get_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.minio_bucket)


def upload_file(data: bytes, content_type: str, filename: str) -> str:
    client = _get_client()
    s3_key = f"attachments/{uuid.uuid4()}/{filename}"
    client.put_object(
        Bucket=settings.minio_bucket,
        Key=s3_key,
        Body=data,
        ContentType=content_type,
    )
    return s3_key


def download_url(s3_key: str, expires: int = 3600) -> str:
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": s3_key},
        ExpiresIn=expires,
    )


def delete_file(s3_key: str) -> None:
    client = _get_client()
    client.delete_object(Bucket=settings.minio_bucket, Key=s3_key)
