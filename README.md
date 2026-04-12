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
