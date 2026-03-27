const logic = {
    // 1. Розрахунок чека (ПДВ 5%)
    calculateInvoice: (sum) => {
        const amount = sum > 0 ? sum : 0; // Захист від від'ємних чисел
        return {
            subtotal: amount,
            tax: amount * 0.05,
            total: amount * 1.05
        };
    },

    // 2. Валідація VIN-коду (рівно 17 символів)
    isValidVIN: (vin) => typeof vin === 'string' && vin.length === 17,

    // 3. Знижка для великих замовлень (> 5000 грн)
    applyDiscount: (sum) => sum > 5000 ? sum * 0.9 : sum,

    // 4. Форматування держномера
    formatPlate: (p) => typeof p === 'string' ? p.replace(/[\s-]/g, '').toUpperCase() : '',

    // 5. Визначення кольору статусу (Рядок 22 тут)
    getStatusColor: (s) => {
        if (s === "Завершено") return "green";
        if (s === "Очікує") return "red";
        return "yellow"; // Це той самий рядок 22, який не покритий
    }
};

module.exports = logic;