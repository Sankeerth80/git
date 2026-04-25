# QuantumTrade Platform

A premium, MVC-architected, and fully scalable stock trading platform built with Node.js, Express, and MongoDB.

## Features
- **Strict MVC Architecture**: Organized, clean, and testable codebase.
- **Atomic Transactions**: Wallet modifications and trades use Mongoose Transactions to guarantee 100% data consistency.
- **Premium Glassmorphism UI**: Beautiful, vibrant, and interactive user interfaces for both traders and admins.
- **Robust Security**: Rate limiting, NoSQL injection protection, and comprehensive error handling.
- **Admin God Mode**: Real-time control over market trends and promo codes.

---

## 🚀 Deployment Guide

This application is ready to be deployed to production using Docker, Railway, or any platform that supports Docker containers.

### 1. MongoDB Atlas Setup
Because this application uses **Mongoose Transactions** for atomic operations (preventing negative balances and double-spend), you MUST use a MongoDB Replica Set. MongoDB Atlas provides this by default.
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Go to **Network Access** and whitelist your specific IP address: `106.208.20.39/32`. Note: If you are deploying to Railway, you should also add `0.0.0.0/0` to allow the Railway servers to connect.
3. Go to **Database Access** and create a user with a password.
4. Go to **Databases** > **Connect** > **Connect your application** and copy the Connection String.
5. Set this string as the `MONGODB_URI` environment variable in your deployment platform.

### 2. Deploying to Railway (Recommended)
Railway natively supports Dockerfile deployments and this repo contains a `railway.json` file.
1. Push this repository to GitHub.
2. Log into [Railway.app](https://railway.app/).
3. Click **New Project** -> **Deploy from GitHub repo** and select your repository.
4. Railway will automatically detect the `Dockerfile` and `railway.json` configuration.
5. Go to the **Variables** tab in Railway and add the following:
   - `MONGODB_URI` = Your Atlas connection string
   - `JWT_SECRET` = A strong secret key
   - `NODE_ENV` = `production`
6. Once built, go to **Settings** -> **Networking** and generate a Public Domain.

### 3. Docker Hub & Manual Deployment
To build and push the Docker image manually to Docker Hub:
```bash
# 1. Build the image
docker build -t your-docker-username/quantumtrade .

# 2. Login to Docker Hub
docker login

# 3. Push the image
docker push your-docker-username/quantumtrade
```

You can then pull this image on any VPS (like DigitalOcean, AWS EC2) and run it:
```bash
docker run -d -p 3000:3000 -e MONGODB_URI="your_atlas_uri" -e NODE_ENV="production" your-docker-username/quantumtrade
```

---

## 🧪 Postman Testing
A comprehensive `quantumtrade.postman_collection.json` is included in the root directory. 
1. Import this file into Postman.
2. Set the `baseUrl` variable to your production URL (or `http://localhost:3000` for local testing).
3. Use the `/api/auth/login` route to get a token, and paste it into the `token` variable to authenticate all other requests.
