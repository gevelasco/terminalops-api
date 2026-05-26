#!/usr/bin/env node
/**
 * Libera el puerto de la API antes de arrancar Nest (evita EADDRINUSE al reiniciar).
 * Usa PORT del entorno o 4000 por defecto.
 */
import { execSync } from 'node:child_process';

const port = String(process.env.PORT ?? 4000);

try {
  execSync(`lsof -ti :${port}`, { stdio: 'ignore' });
  execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
  console.log(`[free-port] Puerto ${port} liberado.`);
} catch {
  /* Nadie escuchando en ese puerto */
}
