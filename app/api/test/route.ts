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
    catch (error){
        console.log(error);
        
        return NextResponse.json({ error: 'Connection failed' }, { status: 500 });
    }
        
}