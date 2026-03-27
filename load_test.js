import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    scenarios: {
        open_dashboard: {
            executor: 'constant-vus',
            vus: 20, // 20 адміністраторів дивляться головну
            duration: '30s',
            exec: 'openDashboard'
        },
        view_client_cars: {
            executor: 'constant-vus',
            vus: 50, // 50 запитів до списку авто
            duration: '30s',
            exec: 'viewCars'
        },
        check_order_status: {
            executor: 'constant-vus',
            vus: 100, // 100 клієнтів перевіряють статус
            duration: '30s',
            exec: 'checkOrder'
        },
    }
};

const BASE_URL = 'http://localhost:3000'; 

export function openDashboard() {
    let res = http.get(`${BASE_URL}/admin/dashboard`);
    check(res, { 'status is 200': (r) => r.status === 200 });
    sleep(1);
}

export function viewCars() {
    let res = http.get(`${BASE_URL}/api/vehicles?clientId=1`);
    check(res, { 'status is 200': (r) => r.status === 200 });
    sleep(1);
}

export function checkOrder() {
    let res = http.get(`${BASE_URL}/api/orders/status/5`);
    check(res, { 'status is 200': (r) => r.status === 200 });
    sleep(1);
}