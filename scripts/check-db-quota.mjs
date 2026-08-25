import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Correr así:');
  console.error('  DATABASE_URL="postgres://...neon..." node scripts/check-db-quota.mjs');
  process.exit(1);
}

const prisma = new PrismaClient();

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return '???';
  }
})();
console.log(`\n== Conectando a ${host} ==\n`);

const [{ size, size_bytes }] = await prisma.$queryRawUnsafe(`
  SELECT
    pg_size_pretty(pg_database_size(current_database())) AS size,
    pg_database_size(current_database())::bigint AS size_bytes
`);
console.log(`DB size: ${size}  (${Number(size_bytes).toLocaleString()} bytes)`);

const NEON_FREE_LIMIT_BYTES = 512 * 1024 * 1024;
const pct = (Number(size_bytes) / NEON_FREE_LIMIT_BYTES) * 100;
console.log(`Vs Neon free (0.5 GiB): ${pct.toFixed(1)}%${pct >= 95 ? '  ← CRÍTICO' : pct >= 80 ? '  ← cerca del techo' : ''}`);

const ro = await prisma.$queryRawUnsafe(`SHOW default_transaction_read_only`);
const tro = await prisma.$queryRawUnsafe(`SHOW transaction_read_only`);
console.log(`\ndefault_transaction_read_only: ${ro[0].default_transaction_read_only}`);
console.log(`transaction_read_only:         ${tro[0].transaction_read_only}`);

try {
  await prisma.$executeRawUnsafe(`
    CREATE TEMP TABLE _writetest_${Date.now()} (x int);
  `);
  console.log(`write test:                    OK (la DB acepta writes)`);
} catch (e) {
  console.log(`write test:                    FALLA → ${e.message}`);
}

console.log('\n== Top 10 tablas por tamaño ==');
const tables = await prisma.$queryRawUnsafe(`
  SELECT
    relname AS table,
    pg_size_pretty(pg_total_relation_size(C.oid)) AS total,
    pg_total_relation_size(C.oid)::bigint AS total_bytes
  FROM pg_class C
  LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
  WHERE nspname NOT IN ('pg_catalog', 'information_schema')
    AND C.relkind = 'r'
  ORDER BY pg_total_relation_size(C.oid) DESC
  LIMIT 10
`);
for (const t of tables) {
  console.log(`  ${t.table.padEnd(35)} ${t.total}`);
}

await prisma.$disconnect();
