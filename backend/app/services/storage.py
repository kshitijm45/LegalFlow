"""
AWS S3 storage service.
All file I/O runs in a thread pool so it doesn't block the async event loop.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.config import settings


def _client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def _make_key(original_filename: str, contract_id: uuid.UUID) -> str:
    """Generate a unique S3 object key."""
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    return f"contracts/{contract_id}.{ext}"


async def upload_file(
    file_bytes: bytes,
    original_filename: str,
    contract_id: uuid.UUID,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload file to S3, return the object key."""
    key = _make_key(original_filename, contract_id)

    def _upload() -> None:
        _client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )

    await asyncio.to_thread(_upload)
    return key


async def download_file(key: str) -> bytes:
    """Download file bytes from S3."""
    def _download() -> bytes:
        resp = _client().get_object(Bucket=settings.s3_bucket, Key=key)
        return resp["Body"].read()

    return await asyncio.to_thread(_download)


async def delete_file(key: str) -> None:
    """Delete an object from S3 (best-effort, ignores missing keys)."""
    def _delete() -> None:
        try:
            _client().delete_object(Bucket=settings.s3_bucket, Key=key)
        except ClientError:
            pass

    await asyncio.to_thread(_delete)


def presigned_url(key: str, expires_in: int = 3600) -> Optional[str]:
    """Return a presigned download URL (sync, fast — no I/O)."""
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except ClientError:
        return None
