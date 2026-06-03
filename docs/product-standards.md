# Product standards

- Backend modules are located in `backend/src/modules/*`.
- Shared constants and contracts live in `shared/`.
- Рекомендовано записувати значущі зміни в `audit_logs` (розширюється за потреби).
- Input validation follows fail-fast style and returns `AppError` codes.
- Security baseline: `helmet`, API rate-limit, auth brute-force limit.
- Data schema changes must go through `backend/src/db/migrations/*.sql` and `scripts/migrate.js`.
