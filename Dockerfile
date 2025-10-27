
CMD ["sh", "-lc", "\
  set -e; \
  echo '[entrypoint] running prisma migrate deploy...'; \
  npx prisma migrate deploy || (echo '[entrypoint] migrate failed, trying db push...' && npx prisma db push); \
  echo '[entrypoint] starting node server...'; \
  exec node server.js \
"]
