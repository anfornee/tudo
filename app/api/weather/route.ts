import { NextResponse } from "next/server";

import { getWeather } from "@/lib/weather";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        {
          error: "Invalid coordinates",
        },
        {
          status: 400,
        },
      );
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        {
          error: "Coordinates out of range",
        },
        {
          status: 400,
        },
      );
    }

    const weather = await getWeather(latitude, longitude);

    return NextResponse.json(weather);
  } catch (error) {
    console.error("Weather request failed:", error);

    return NextResponse.json(
      {
        error: "Unable to retrieve weather",
      },
      {
        status: 500,
      },
    );
  }
}
