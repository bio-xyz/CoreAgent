"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callbackDateRangeLogic = exports.addOneDay = exports.formatDate = exports.parseDate = void 0;
const parseDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
};
exports.parseDate = parseDate;
const formatDate = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};
exports.formatDate = formatDate;
const addOneDay = (dateObj) => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + 1);
    return next;
};
exports.addOneDay = addOneDay;
const callbackDateRangeLogic = async (filter, callback) => {
    if (filter.after && filter.before) {
        let current = (0, exports.parseDate)(filter.after);
        const end = (0, exports.parseDate)(filter.before);
        while (current <= end) {
            const dayStr = (0, exports.formatDate)(current);
            await callback(dayStr);
            current = (0, exports.addOneDay)(current);
        }
    }
    else if (filter.filterType === 'during' && filter.date) {
        await callback(filter.date);
    }
    else if (filter.filterType === 'before' && filter.date) {
        const earliest = new Date(2025, 0, 1);
        let current = earliest;
        const end = (0, exports.parseDate)(filter.date);
        while (current <= end) {
            const dayStr = (0, exports.formatDate)(current);
            await callback(dayStr);
            current = (0, exports.addOneDay)(current);
        }
    }
    else if (filter.filterType === 'after' && filter.date) {
        let current = (0, exports.parseDate)(filter.date);
        const today = new Date();
        while (current <= today) {
            const dayStr = (0, exports.formatDate)(current);
            await callback(dayStr);
            current = (0, exports.addOneDay)(current);
        }
    }
};
exports.callbackDateRangeLogic = callbackDateRangeLogic;
