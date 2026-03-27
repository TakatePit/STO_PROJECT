const calculateInvoice = (sum) => ({
    subtotal: sum,
    tax: sum * 0.05,
    total: sum * 1.05,
});

const isValidVIN = (vin) => Boolean(vin && vin.length === 17);

const applyDiscount = (sum) => (sum > 5000 ? sum * 0.9 : sum);

module.exports = { calculateInvoice, isValidVIN, applyDiscount };