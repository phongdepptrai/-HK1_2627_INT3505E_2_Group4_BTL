import { createApp } from './app.js';
const port = Number(process.env.PORT || 3001);
const { app } = createApp();
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Kèo Sân mock API: http://127.0.0.1:${port}/api/v1`);
  console.log(`Swagger UI: http://127.0.0.1:${port}/docs`);
  console.log('In-memory demo only. Restarting clears bookings and sessions.');
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
