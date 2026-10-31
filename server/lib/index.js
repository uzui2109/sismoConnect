"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const profiles_1 = __importDefault(require("./routes/profiles"));
const social_1 = __importDefault(require("./routes/social"));
const chats_1 = __importDefault(require("./routes/chats"));
const emergency_1 = __importDefault(require("./routes/emergency"));
const firebase_admin_1 = require("./lib/firebase-admin");
dotenv_1.default.config();
const app = (0, express_1.default)();
(0, firebase_admin_1.getAdminApp)();
const allowedOrigins = [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:19006',
    'http://127.0.0.1:19006',
];
const corsOrigin = process.env.CORS_ORIGIN === '*' ? true : allowedOrigins;
app.use((0, cors_1.default)({
    origin: corsOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', (0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.use('/profiles', profiles_1.default);
app.use('/social', social_1.default);
app.use('/chats', chats_1.default);
app.use('/emergencyState', emergency_1.default);
app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada.' });
});
app.use((err, _req, res, _next) => {
    console.error('[server] unhandled error:', err);
    res.status(err?.status || 500).json({
        message: err?.message || 'Error interno del servidor',
    });
});
const port = Number(process.env.PORT) || 8085;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});
