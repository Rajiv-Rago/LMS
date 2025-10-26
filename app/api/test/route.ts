// app/api/test/route.ts

import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    try{
        let conn = await dbConnect();

        return NextResponse.json({
        status: "success",
        host: conn.connection.host,
        name: conn.connection.name,
        readyState: conn.connection.readyState, // 1 means connected
        });
    }
    catch (e:any) {
        console.log(e?.message);
        return NextResponse.json({ ok:false, error:e?.message }, { status:500 });
  }
        
}