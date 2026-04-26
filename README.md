# QuantumTrade Platform Integration Guide

A premium, MVC-architected, and fully scalable stock trading platform. This project is fully configured and ready to be used with **MongoDB Atlas**, **MongoDB Compass**, **Docker Desktop**, and **Git**.

---

## 1. ☁️ MongoDB Atlas (Cloud Database)
Because this application uses **Mongoose Transactions** for atomic operations (preventing negative balances and double-spend), you MUST use a MongoDB Replica Set. MongoDB Atlas provides this natively.
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Go to **Network Access** and whitelist `0.0.0.0/0` (This allows your local machine and cloud servers to connect).
3. Go to **Database Access** and create a user (e.g., `AdminTrader`).
4. Go to **Databases** > **Connect** > **Connect your application** and copy the Connection String.
5. Paste this connection string into your `.env` file as `MONGODB_URI`.

## 2. 🧭 MongoDB Compass (Database UI)
To view and edit your live production data on your computer:
1. Open **MongoDB Compass**.
2. Click **New Connection**.
3. Paste the exact same `MONGODB_URI` connection string you got from MongoDB Atlas.
4. Click **Connect**.
5. You can now visually manage the `users`, `promos`, and `transactions` tables!

## 3. 🐳 Docker Desktop (Containerization)
This application comes with full Docker configuration (`Dockerfile`, `docker-compose.yml`, and `docker-compose.atlas.yml`). To run it locally on your machine using Docker Desktop:

1. Ensure **Docker Desktop** is open and running on your computer.
2. Open your terminal in the `quantumtrade` folder.
3. Run the application connected to your live Atlas database using this command:
   ```bash
   docker-compose -f docker-compose.atlas.yml up --build
   ```
4. The QuantumTrade server will spin up inside Docker and be accessible at `http://localhost:3000`.

*(Note: If you want to run a local isolated database instead of Atlas, simply run `docker-compose up`)*

## 4. 🐙 Git (Version Control & CI/CD)
Your repository is connected to GitHub. Every time you push code, GitHub Actions automatically builds and tests your Docker container.
1. Stage your changes:
   ```bash
   git add .
   ```
2. Commit your changes:
   ```bash
   git commit -m "Update application features"
   ```
3. Push to GitHub to trigger deployments (e.g. Render/Railway):
   ```bash
   git push origin main
   ```

---

## Features
- **Strict MVC Architecture**: Organized, clean, and testable codebase.
- **Atomic Transactions**: Wallet modifications and trades use Mongoose Transactions to guarantee 100% data consistency.
- **Premium Glassmorphism UI**: Beautiful, vibrant, and interactive user interfaces for both traders and admins.
- **Robust Security**: Rate limiting, NoSQL injection protection, ReDoS protection, and comprehensive error handling.
- **Admin God Mode**: Real-time control over market trends and promo codes.
