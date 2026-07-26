// ===== دیتابیس کارمندان =====
const API_URL = 'https://dane34790-sys.github.io/employee-app/';
let employees = [];

async function loadEmployees() {
    try {
        const res = await fetch(API_URL + 'employees.json');
        employees = await res.json();
    } catch {
        employees = JSON.parse(localStorage.getItem('fribus_employees') || '[]');
    }
}

// ===== حالت‌های POS =====
let currentState = 'swipe';
let currentEmployee = null;
let pinAttempts = 0;

// ===== اتصال مستقیم به POS (WebHID) =====
async function connectToPOS() {
    try {
        const devices = await navigator.hid.requestDevice({
            filters: [{ vendorId: 0x1234 }]
        });

        if (!devices.length) return;

        const device = devices[0];
        await device.open();

        device.oninputreport = (event) => {
            const track2Data = decodeTrack2(event.data);
            handleCardSwipe(track2Data);
        };

        console.log("✅ POS Connected");
    } catch (err) {
        console.error("POS Connection Error:", err);
    }
}

function decodeTrack2(data) {
    return new TextDecoder().decode(data.buffer).trim();
}

// ===== دریافت Track2 از POS Keyboard =====
let track2Buffer = '';

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
        e.preventDefault();
        simulateCardSwipe();
        return;
    }

    if (e.key === ';') {
        track2Buffer = ';';
        return;
    }

    if (track2Buffer.length > 0) {
        track2Buffer += e.key;

        if (e.key === '?') {
            handleCardSwipe(track2Buffer);
            track2Buffer = '';
        }
    }
});

// ===== صفحه اصلی: منتظر کارت =====
function showSwipeScreen() {
    currentState = 'swipe';
    currentEmployee = null;
    pinAttempts = 0;

    document.getElementById('posScreen').innerHTML = `
        <div class="swipe-screen">
            <div>
                <div class="card-icon">💳</div>
                <div class="title">MASTERCARD</div>
                <div class="subtitle">Commerzbank Secure Terminal</div>
                <div class="subtitle" style="margin-top:20px; color:#ffcc00;">کارت را بکشید</div>
            </div>
        </div>
    `;
}

// ===== پردازش کشیدن کارت =====
function handleCardSwipe(track2Data) {
    const employeeCode = track2Data.slice(-14, -1);
    const employee = employees.find(emp => emp.id === employeeCode);

    if (!employee) {
        showResult('❌', 'کارت نامعتبر', '#ff4444');
        return;
    }

    if (employee.fribusBalance <= 0) {
        showResult('❌', `👤 ${employee.name}\n💰 موجودی صفر`, '#ff4444');
        return;
    }

    currentEmployee = employee;
    showPinScreen();
}

// ===== صفحه PIN =====
function showPinScreen() {
    currentState = 'pin';
    let pinInput = '';

    function renderPin() {
        document.getElementById('posScreen').innerHTML = `
            <div class="pin-screen">
                <h2 style="color:#ffcc00;">💳 MASTERCARD</h2>
                <p style="color:#ccc; margin-top:10px;">PIN خود را وارد کنید</p>
                <div class="pin-dots">
                    ${'●'.repeat(pinInput.length)}${'○'.repeat(4 - pinInput.length)}
                </div>
                <div class="pin-keypad">
                    ${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(key => `
                        <button class="pin-key ${key === '⌫' ? 'clear' : ''}" 
                                onclick="handlePinKey('${key}')">${key}</button>
                    `).join('')}
                </div>
                <button onclick="showSwipeScreen()" 
                        style="margin-top:20px; padding:10px 30px; background:#ff4444; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:16px;">انصراف</button>
            </div>
        `;
    }

    window.handlePinKey = (key) => {
        if (key === '⌫') {
            pinInput = pinInput.slice(0, -1);
        } else if (key === '✓') {
            if (pinInput.length === 4) verifyPin(pinInput);
            return;
        } else if (pinInput.length < 4) {
            pinInput += key;
        }
        renderPin();
        if (pinInput.length === 4) setTimeout(() => verifyPin(pinInput), 300);
    };

    function verifyPin(enteredPin) {
        if (enteredPin === currentEmployee.posPin) {
            pinAttempts = 0;
            showAmountScreen();
        } else {
            pinAttempts++;
            if (pinAttempts >= 3) {
                showResult('🔒', 'کارت مسدود شد\n۳ بار PIN اشتباه', '#ff4444');
                return;
            }
            pinInput = '';
            renderPin();
            alert(`❌ PIN اشتباه\n${3 - pinAttempts} فرصت باقی مانده`);
        }
    }

    renderPin();
}

// ===== صفحه مبلغ =====
function showAmountScreen() {
    currentState = 'amount';

    document.getElementById('posScreen').innerHTML = `
        <div class="amount-screen">
            <h2 style="color:#ffcc00;">💳 MASTERCARD</h2>
            <div class="employee-info">
                👤 ${currentEmployee.name}<br>
                💰 موجودی: ${currentEmployee.fribusBalance.toLocaleString()} ریال
            </div>
            <input type="number" id="amountInput" class="amount-input" placeholder="مبلغ (ریال)" autofocus>
            <div style="margin-top:20px;">
                <button class="amount-btn" onclick="processPayment()">پرداخت</button>
                <button class="amount-btn cancel" onclick="showSwipeScreen()">انصراف</button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:20px; max-width:300px;">
                ${[100000, 200000, 500000, 1000000, 2000000, 'سایر'].map(amount => `
                    <button onclick="setQuickAmount('${amount}')" 
                            style="padding:12px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid #ffcc00; border-radius:8px; cursor:pointer; font-size:12px;">
                        ${amount === 'سایر' ? amount : parseInt(amount).toLocaleString()}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    window.setQuickAmount = (amount) => {
        if (amount === 'سایر') {
            document.getElementById('amountInput').focus();
        } else {
            document.getElementById('amountInput').value = amount;
            processPayment();
        }
    };

    window.processPayment = () => {
        const amount = parseInt(document.getElementById('amountInput').value);
        if (!amount || amount <= 0) { alert('مبلغ را وارد کنید'); return; }
        if (amount > currentEmployee.fribusBalance) {
            showResult('❌', 'موجودی ناکافی', '#ff4444');
            return;
        }

        currentEmployee.fribusBalance -= amount;
        saveEmployeeData(currentEmployee);
        logTransaction(currentEmployee, amount);
        syncWithServer(currentEmployee);

        showResult('✅', 
            `پرداخت موفق\n👤 ${currentEmployee.name}\n💰 مبلغ: ${amount.toLocaleString()} ریال\n💳 باقیمانده: ${currentEmployee.fribusBalance.toLocaleString()} ریال`,
            '#00ff41');
    };

    setTimeout(() => document.getElementById('amountInput')?.focus(), 100);
}

// ===== صفحه نتیجه =====
function showResult(icon, msg, color) {
    currentState = 'result';
    currentEmployee = null;

    document.getElementById('posScreen').innerHTML = `
        <div class="result-screen">
            <div class="result-icon">${icon}</div>
            <div class="result-msg" style="color:${color};">${msg}</div>
            <button class="new-transaction-btn" onclick="showSwipeScreen()">تراکنش جدید</button>
        </div>
    `;

    setTimeout(() => {
        if (currentState === 'result') showSwipeScreen();
    }, 5000);
}

// ===== ذخیره و همگام‌سازی =====
function saveEmployeeData(employee) {
    const index = employees.findIndex(emp => emp.id === employee.id);
    if (index >= 0) employees[index] = employee;
    localStorage.setItem('fribus_employees', JSON.stringify(employees));
}

function logTransaction(employee, amount) {
    const transactions = JSON.parse(localStorage.getItem('pos_transactions') || '[]');
    transactions.push({
        employeeId: employee.id,
        employeeName: employee.name,
        amount: amount,
        balanceAfter: employee.fribusBalance,
        terminal: 'POS',
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('pos_transactions', JSON.stringify(transactions));
}

async function syncWithServer(employee) {
    try {
        await fetch(API_URL + 'api/update-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: employee.id, newBalance: employee.fribusBalance })
        });
    } catch {
        const pendingSync = JSON.parse(localStorage.getItem('pending_sync') || '[]');
        pendingSync.push({ employeeId: employee.id, newBalance: employee.fribusBalance, timestamp: new Date().toISOString() });
        localStorage.setItem('pending_sync', JSON.stringify(pendingSync));
    }
}

// ===== شبیه‌ساز =====
function simulateCardSwipe() {
    const testTrack2 = `;5232242096782971=26061210000001784908453620?`;
    handleCardSwipe(testTrack2);
}

// ===== راه‌اندازی =====
loadEmployees();
showSwipeScreen();

if ('hid' in navigator) {
    connectToPOS();
}

console.log('💳 POS Terminal Ready');
console.log('F12 = شبیه‌ساز');
console.log('WebHID = تشخیص خودکار POS');
console.log('Keyboard = کشیدن کارت');

// ===== HTTP Server برای دریافت Track 2 از POS =====
let httpServer = null;
const SERVER_PORT = 3000;

async function startPOSServer() {
    try {
        // استفاده از Service Worker برای دریافت درخواست‌های HTTP
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('pos-sw.js');
            console.log('📡 POS Server آماده روی پورت ' + SERVER_PORT);
            console.log('📍 آدرس: http://' + getLocalIP() + ':' + SERVER_PORT + '/api/swipe');
        }
    } catch (err) {
        console.error('❌ خطای راه‌اندازی سرور:', err);
    }
}

function getLocalIP() {
    // IP پیش‌فرض Hotspot اندروید
    return '192.168.43.1';
}

// ===== پردازش درخواست از POS =====
async function handlePOSRequest(request) {
    if (request.method === 'POST' && request.url.includes('/api/swipe')) {
        const data = await request.text();
        const track2Data = data.trim();
        
        console.log('📡 دریافت از POS:', track2Data);
        
        // پردازش کارت
        handleCardSwipe(track2Data);
        
        return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response('Not Found', { status: 404 });
}

// ===== راه‌اندازی =====
startPOSServer();
