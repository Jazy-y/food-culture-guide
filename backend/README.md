# Express + MySQL prototype (not used by the mobile app)

An early authentication prototype written before the app moved to Firebase
Authentication. The Expo app does **not** call this server.

```bash
cd backend
npm install
mysql -u <user> -p -e "CREATE DATABASE IF NOT EXISTS food_culture_guide"
mysql -u <user> -p food_culture_guide < schema.sql
DB_USER=<user> DB_PASSWORD=<password> DB_NAME=food_culture_guide npm start
```

Endpoints: `POST /api/register` and `POST /api/login` (bcrypt-hashed passwords).
There is no session or token issuance, and CORS is open, so it is not suitable
for production use.
