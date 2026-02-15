"""
Creates two demo users directly in the database:
  steward@demo.com  / password: steward123   (role: steward)
  viewer@demo.com   / password: viewer123    (role: viewer)

Run inside the container:
  docker compose exec backend python create_demo_users.py
"""
import asyncio
import uuid

from passlib.context import CryptContext
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_USERS = [
    {
        "email": "steward@demo.com",
        "name": "Demo Steward",
        "role": "steward",
        "password": "steward123",
    },
    {
        "email": "viewer@demo.com",
        "name": "Demo Viewer",
        "role": "viewer",
        "password": "viewer123",
    },
]


async def main():
    async with AsyncSessionLocal() as db:
        for u in DEMO_USERS:
            result = await db.execute(select(User).where(User.email == u["email"]))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  Already exists: {u['email']} (skipped)")
                continue

            user = User(
                id=uuid.uuid4(),
                email=u["email"],
                name=u["name"],
                role=u["role"],
                oauth_provider="local",
                oauth_sub=u["email"],
                password_hash=pwd_context.hash(u["password"]),
            )
            db.add(user)
            print(f"  Created: {u['email']}  (password: {u['password']})  role: {u['role']}")

        await db.commit()

    print("\nDemo users ready!")
    print("  Email: steward@demo.com   Password: steward123   Role: steward")
    print("  Email: viewer@demo.com    Password: viewer123    Role: viewer")


if __name__ == "__main__":
    asyncio.run(main())
