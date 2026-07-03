import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

const DB_NAME = "attendance_management_system";
const USER_COUNT = 10;
const GENERATED_EMAIL_DOMAIN = "example.test";
const GENERATED_EMAIL_PREFIX = "testuser";
const GENERATED_PHONE_PREFIX = "900000";

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const envFile = fs.readFileSync(filePath, "utf8");

    for (const line of envFile.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function defineModels() {
    const userSchema = new mongoose.Schema({
        name: { type: String, required: true, index: true },
        email: { type: String, unique: true, sparse: true, index: true, match: /.+@.+\..+/ },
        image: { type: String },
        password: { type: String },
        role: { type: String, enum: ["admin", "user"], default: "user", required: true },
        isVerified: { type: Boolean, default: true, required: true },
        isBlocked: { type: Boolean, default: false },
        phoneNumber: { type: String, unique: true, sparse: true },
        address: { type: String },
    });

    const punchSchema = new mongoose.Schema(
        {
            type: { type: String, enum: ["IN", "OUT"], required: true },
            timestamp: { type: Date, default: Date.now },
            location: {
                latitude: { type: Number },
                longitude: { type: Number },
                accuracy: { type: Number },
            },
        },
        { _id: false }
    );

    const attendanceSchema = new mongoose.Schema(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            date: { type: String, required: true },
            name: { type: String, required: true },
            email: { type: String, required: true },
            currentStatus: { type: String, enum: ["IN", "OUT"], default: "OUT" },
            punches: [punchSchema],
            totalMinutesWorked: { type: Number, default: 0 },
        },
        { timestamps: true }
    );

    attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

    return {
        User: mongoose.models.User || mongoose.model("User", userSchema),
        Attendance:
            mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema),
    };
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function toDateString(date) {
    return date.toISOString().slice(0, 10);
}

function getDateRangeForLastTwoMonths() {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = addDays(end, -59);
    const dates = [];

    for (let current = start; current <= end; current = addDays(current, 1)) {
        dates.push(new Date(current));
    }

    return dates;
}

function getWorkPunches(date) {
    const day = date.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const attendanceChance = isWeekend ? 0.15 : 0.88;

    if (Math.random() > attendanceChance) {
        return null;
    }

    const inHour = randomInt(8, 10);
    const inMinute = randomInt(0, 59);
    const workedMinutes = randomInt(isWeekend ? 180 : 390, isWeekend ? 360 : 560);
    const inTime = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), inHour, inMinute));
    const outTime = new Date(inTime.getTime() + workedMinutes * 60 * 1000);
    const location = {
        latitude: 28.6139 + Math.random() * 0.03,
        longitude: 77.209 + Math.random() * 0.03,
        accuracy: randomInt(8, 35),
    };

    return {
        punches: [
            { type: "IN", timestamp: inTime, location },
            { type: "OUT", timestamp: outTime, location },
        ],
        totalMinutesWorked: workedMinutes,
    };
}

function buildUsers() {
    return Array.from({ length: USER_COUNT }, (_, index) => {
        const userNumber = index + 1;

        return {
            name: `Test User ${userNumber}`,
            email: `${GENERATED_EMAIL_PREFIX}${userNumber}@${GENERATED_EMAIL_DOMAIN}`,
            role: "user",
            isVerified: true,
            isBlocked: false,
            phoneNumber: `${GENERATED_PHONE_PREFIX}${String(userNumber).padStart(4, "0")}`,
            address: `Random Test Address ${userNumber}`,
        };
    });
}

async function seed() {
    loadEnvFile(path.join(process.cwd(), ".env"));

    const baseUri = process.env.MONGODB_URI;

    if (!baseUri) {
        throw new Error("Missing MONGODB_URI environment variable");
    }

    const { User, Attendance } = defineModels();

    await mongoose.connect(`${baseUri}/${DB_NAME}`);

    const users = [];

    for (const userData of buildUsers()) {
        const user = await User.findOneAndUpdate(
            { email: userData.email },
            { $set: userData },
            { returnDocument: "after", upsert: true, runValidators: true }
        );

        users.push(user);
    }

    const dates = getDateRangeForLastTwoMonths();
    const startDate = toDateString(dates[0]);
    const endDate = toDateString(dates[dates.length - 1]);
    const userIds = users.map((user) => user._id);

    await Attendance.deleteMany({
        userId: { $in: userIds },
        date: { $gte: startDate, $lte: endDate },
    });

    const attendanceRecords = [];

    for (const user of users) {
        for (const date of dates) {
            const workDay = getWorkPunches(date);

            if (!workDay) {
                continue;
            }

            attendanceRecords.push({
                userId: user._id,
                date: toDateString(date),
                name: user.name,
                email: user.email,
                currentStatus: "OUT",
                punches: workDay.punches,
                totalMinutesWorked: workDay.totalMinutesWorked,
            });
        }
    }

    if (attendanceRecords.length > 0) {
        await Attendance.insertMany(attendanceRecords, { ordered: false });
    }

    console.log(`Seeded ${users.length} users.`);
    console.log(`Seeded ${attendanceRecords.length} attendance records from ${startDate} to ${endDate}.`);
}

seed()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
