# Room Booking API

![CI](https://github.com/DariuszMedrala/-room-booking-api/actions/workflows/ci.yml/badge.svg)

REST API do rezerwacji sal z uwierzytelnianiem JWT, kontrolą dostępu opartą na rolach,
dokumentacją Swagger, testami oraz uruchomieniem przez Docker Compose.

## Uruchomienie od zera (Docker)

Wymagania: zainstalowany Docker i Docker Compose.

```bash
git clone <adres-repozytorium>
cd RoomBookingApi
cp .env.example .env
docker compose up --build
```

Po starcie:

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/api/docs

Migracje bazy uruchamiają się automatycznie przy starcie kontenera `api`.

### Seed z kontem ADMIN

W działającym kontenerze:

```bash
docker compose exec api npx knex seed:run
```

Dane logowania konta ADMIN: `admin@example.com` / `admin-password-123`.

### Zatrzymanie

```bash
docker compose down
```

Aplikacja obsługuje `SIGTERM` (graceful shutdown), więc kontener zatrzymuje się od razu,
bez czekania na `SIGKILL`.

## Testy

```bash
npm install
npm test              # unit + integration
npm run test:unit
npm run test:integration
```

Testy integracyjne korzystają z osobnej bazy testowej (`roombooking_test`), tworzonej automatycznie.

## Konfiguracja

Wszystkie zmienne środowiskowe są walidowane schematem Zod w `src/config`. Wzór: `.env.example`.

| Zmienna | Opis |
|---------|------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | konfiguracja kontenera PostgreSQL |
| `DATABASE_URL` | connection string (w Dockerze host to `db`) |
| `JWT_SECRET` | sekret JWT (minimum 32 znaki) |
| `JWT_EXPIRES_IN` | czas życia tokenu (domyślnie `15m`) |
| `PORT` | port API (domyślnie `3000`) |

> Uruchamiając API lokalnie bez Dockera (`node src/server.js`), ustaw w `DATABASE_URL` host `localhost` zamiast `db`.
