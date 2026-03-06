import mongoose from "mongoose";
import { NextResponse } from "next/server";

export function validateObjectId(
  id: string,
  label: string = "ID"
): NextResponse | null {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: `Invalid ${label}` },
      { status: 400 }
    );
  }
  return null;
}
