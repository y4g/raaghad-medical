"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'الخادم يعمل بصورة طبيعية',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
