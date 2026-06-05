import { NextResponse } from "next/server";
import { boards, players, worldStats } from "@/lib/sample-data";
export function GET() { return NextResponse.json({ world: worldStats, boards, players }); }
