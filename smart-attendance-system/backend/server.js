const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode");
const crypto = require("crypto");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ MongoDB Connection Failed", err));

// ✅ Attendance Schema
const Attendance = mongoose.model("Attendance", new mongoose.Schema({
    studentId: String,
    sessionId: String,
    timestamp: Date,
    latitude: Number,
    longitude: Number
}));

let activeQRCodes = {}; // Store active QR codes

// ✅ Generate Dynamic QR Code
app.get("/generate-qr", async (req, res) => {
    const sessionId = crypto.randomUUID(); // Unique session ID
    const qrData = { sessionId, timestamp: Date.now() };

    activeQRCodes[sessionId] = qrData; // Temporarily store session data

    const qrCodeImage = await qrcode.toDataURL(JSON.stringify(qrData));

    // Store session in MongoDB (Optional)
    // await Attendance.create({ sessionId, timestamp: new Date() });

    res.json({ qrCodeImage, sessionId });
});

// ✅ Verify QR Code & Location Check
app.post("/scan-qr", async (req, res) => {
    const { sessionId, studentId, latitude, longitude } = req.body;

    if (!activeQRCodes[sessionId]) {
        return res.status(400).json({ message: "❌ Invalid or expired QR code" });
    }

    // Classroom GPS Coordinates (Change these)
    const CLASSROOM_LAT = 28.6139;  
    const CLASSROOM_LON = 77.2090;  
    const ALLOWED_RADIUS = 50;  // 50 meters range

    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    const distance = getDistance(latitude, longitude, CLASSROOM_LAT, CLASSROOM_LON);

    if (distance > ALLOWED_RADIUS) {
        return res.status(403).json({ message: "❌ You are not inside the classroom!" });
    }

    // ✅ Store attendance in MongoDB
    await Attendance.create({ studentId, sessionId, timestamp: new Date(), latitude, longitude });

    res.json({ message: "✅ Attendance marked successfully!" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
