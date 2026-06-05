import mysql from "mysql2/promise";
import { execFileSync } from "node:child_process";

function mysqlRootPassword() {
  if (process.env.MYSQL_ROOT_PASSWORD) return process.env.MYSQL_ROOT_PASSWORD;
  const env = execFileSync("docker", ["exec", "empire-mysql", "sh", "-lc", "printf %s \"$MYSQL_ROOT_PASSWORD\""], { encoding: "utf8" });
  return env.trim();
}

export async function pool() {
  return mysql.createPool({ host: process.env.MYSQL_HOST ?? "127.0.0.1", port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER ?? "root", password: mysqlRootPassword(), database: process.env.MYSQL_DATABASE ?? "minecraft_dashboard", waitForConnections: true, connectionLimit: 4 });
}
