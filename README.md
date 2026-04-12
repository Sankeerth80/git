# QuantumTrade

A simple trading platform backend and frontend demo built with Express, MongoDB, and a static auth landing page.

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Then open:

- `http://localhost:3000` for the user auth page
- `http://localhost:3000/admin` for the admin dashboard

## Default accounts

The server creates defaults on startup if they do not exist:

- Admin: `admin` / `Admin@1234`
- User: `Sankeerth` / `Sankeerth@80`

You can override using environment variables:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DEFAULT_USERNAME`
- `DEFAULT_PASSWORD`
- `MONGODB_URI`
- `JWT_SECRET`

## Environment Variables

You can also create a `.env` file in the project root with:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/quantumtrade
JWT_SECRET=your_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@1234
```

Then start the app with:

```bash
npm install
npm start
```

## API Endpoints

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `GET /api/users`
- `GET /api/promos`
- `POST /api/promos`
- `POST /api/promos/redeem`
- `GET /api/market-trend`
- `POST /api/market-trend`
- `GET /market`
- `GET /health`

## Postman

A sample Postman collection is included in `quantumtrade.postman_collection.json` for testing the API endpoints.

## Notes

- `logs/access.log` and `logs/error.log` are created at runtime for monitoring requests and errors.
- Make sure MongoDB is running locally or provide `MONGODB_URI`.
- The app uses JWT authentication; set `JWT_SECRET` in production.

## Deployment

This app can be deployed to hosts such as Render, Railway, or any Docker-compatible platform.

### Render

1. Create an account at `https://render.com`.
2. Connect your GitHub repository.
3. Create a new Web Service.
4. Select `npm install` as the build command and `npm start` as the start command.
5. Set these environment variables in Render:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
6. Deploy.

### Docker

A `Dockerfile` is included, so you can deploy with containers.

Build and run locally:

```bash
docker build -t quantumtrade .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb://127.0.0.1:27017/quantumtrade" \
  -e JWT_SECRET="your_secret_here" \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="Admin@1234" \
  quantumtrade
```

## Publish to GitHub

1. Initialize the repository:

```bash
git init
```

2. Add files and create the first commit:

```bash
git add .
git commit -m "Initial commit: QuantumTrade app with auth, admin dashboard, and logging"
```

3. Add your GitHub remote and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
 git branch -M main
git push -u origin main
```
