# Catálogo propio de casetas (MX)

Fuentes:

- `casetas_2025.csv` — geometría / identidad (`ID_PLAZA`, `NOMBRE`, `SECCION`, `lat`, `lng`)
- `tarifas_2025.csv` — precios por tipo (`ID_PLAZA` + columnas `T_*`)

Unión por `ID_PLAZA`. Si una plaza tiene varias filas de tarifa (entrada/salida),
se elige la fila “propia” (`NOMBRE_ENT` = `NOMBRE_SAL`) cuando existe.

La RNC registra un punto por sentido de circulación (ida/vuelta) y a veces por
cabina. El seed fusiona filas cercanas (≤ 150 m) del mismo nombre o sección, y
renombra `N/D` usando la sección (p. ej. San Marcos, Sayula).

Regenerar seed JSON (para la migración):

```bash
npm run tolls:build-seed
```

La tabla destino es `terminalops.toll_plazas`.
