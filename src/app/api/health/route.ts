import { NextResponse } from "next/server";
export function GET() { return NextResponse.json({ status: "ok", app: "minecraft-dashboard", world: "gizmo-ivan-dole" }); }
