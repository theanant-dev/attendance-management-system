import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import Attendance, { IPunch } from "@/models/attendance.model";
import connectDB from "@/db/mongodb";
import { authOptions } from "../auth/[...nextauth]/options";
import { getDateKey } from "@/lib/india-date";

const LAB_LOCATION = {
    latitude: 25.5999947,
    longitude: 85.1603588,
};
const MAX_ATTENDANCE_DISTANCE_METERS = 50;

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown error";
}

function getDistanceInMeters(
    firstLocation: { latitude: number; longitude: number },
    secondLocation: { latitude: number; longitude: number }
) {
    const earthRadiusMeters = 6371000;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const lat1 = toRadians(firstLocation.latitude);
    const lat2 = toRadians(secondLocation.latitude);
    const deltaLat = toRadians(secondLocation.latitude - firstLocation.latitude);
    const deltaLon = toRadians(secondLocation.longitude - firstLocation.longitude);
    const haversine =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function isValidLocation(location: unknown): location is {
    latitude: number;
    longitude: number;
    accuracy?: number;
} {
    if (!location || typeof location !== "object") {
        return false;
    }

    const maybeLocation = location as {
        latitude?: unknown;
        longitude?: unknown;
        accuracy?: unknown;
    };

    return (
        typeof maybeLocation.latitude === "number" &&
        typeof maybeLocation.longitude === "number" &&
        Number.isFinite(maybeLocation.latitude) &&
        Number.isFinite(maybeLocation.longitude) &&
        (maybeLocation.accuracy === undefined ||
            (typeof maybeLocation.accuracy === "number" &&
                Number.isFinite(maybeLocation.accuracy)))
    );
}

async function getAuthenticatedUser() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return null;
    }

    if (!session.user._id) {
        throw new Error("Missing userId");
    }

    return session.user;
}

export async function GET() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const today = getDateKey();
        const attendance = await Attendance.findOne({
            userId: new mongoose.Types.ObjectId(user._id),
            date: today,
        }).lean();

        return NextResponse.json({ success: true, data: attendance });
    } catch (error: unknown) {
        console.error("Attendance GET Error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const body = await request.json();
        const { isMarkingIn, location } = body;

        if (!isValidLocation(location)) {
            return NextResponse.json(
                { error: "Location permission is required to mark attendance." },
                { status: 400 }
            );
        }

        const distance = getDistanceInMeters(location, LAB_LOCATION);

        if (distance > MAX_ATTENDANCE_DISTANCE_METERS) {
            return NextResponse.json(
                {
                    error: `You are ${Math.round(distance)}m away from the lab. Attendance is allowed only within ${MAX_ATTENDANCE_DISTANCE_METERS}m.`,
                },
                { status: 403 }
            );
        }

        const today = getDateKey();
        const newStatus = isMarkingIn ? "IN" : "OUT";

        const existingAttendance = await Attendance.findOne({
            userId: new mongoose.Types.ObjectId(user._id),
            date: today,
        });

        if (existingAttendance?.punches?.some((punch: IPunch) => punch.type === newStatus)) {
            return NextResponse.json(
                { error: `You have already marked ${newStatus} today.` },
                { status: 409 }
            );
        }

        const newPunch: IPunch = {
            type: newStatus,
            timestamp: new Date(),
        };

        if (location && location.latitude && location.longitude) {
            newPunch.location = location;
        }

        const updatedAttendance = await Attendance.findOneAndUpdate(
            {
                userId: new mongoose.Types.ObjectId(user._id),
                date: today,
            },
            {
                $set: { currentStatus: newStatus },
                $push: { punches: newPunch },
                $setOnInsert: {
                    userId: new mongoose.Types.ObjectId(user._id),
                    date: today,
                    name: user.name || "User",
                    email: user.email || "",
                },
            },
            {
                new: true,
                upsert: true,
            }
        );

        return NextResponse.json({ success: true, data: updatedAttendance });
    } catch (error: unknown) {
        console.error("Attendance API Error:", error);

        const errorMessage = getErrorMessage(error);

        if (errorMessage === "Missing userId") {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
