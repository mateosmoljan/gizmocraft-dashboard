import mysql from "mysql2/promise";
import { execFileSync } from "node:child_process";

let cachedRootPassword;
let sharedPool;

function mysqlRootPassword() {
  if (process.env.MYSQL_ROOT_PASSWORD) return process.env.MYSQL_ROOT_PASSWORD;
  if (cachedRootPassword) return cachedRootPassword;
  const env = execFileSync("docker", ["exec", "empire-mysql", "sh", "-lc", "printf %s \"$MYSQL_ROOT_PASSWORD\""], { encoding: "utf8" });
  cachedRootPassword = env.trim();
  return cachedRootPassword;
}

export async function pool() {
  if (!sharedPool) {
    const realPool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "root",
      password: mysqlRootPassword(),
      database: process.env.MYSQL_DATABASE ?? "minecraft_dashboard",
      waitForConnections: true,
      connectionLimit: 4,
    });
    sharedPool = Object.create(realPool);
    sharedPool.end = async () => {};
  }
  return sharedPool;
}
