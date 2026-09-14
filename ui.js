const STORAGE_KEY = "subscription-tracker-data";

// localStorage에 저장된 구독 목록을 읽어 배열로 반환한다.
// 저장된 값이 없거나 JSON 형식이 잘못되었으면 빈 배열로 시작한다.
function loadSubscriptions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        return [];
    }
}

// 현재 구독 목록을 JSON 문자열로 바꾸어 localStorage에 저장한다.
// 브라우저를 닫았다가 다시 열어도 데이터가 남도록 하는 함수다.
function saveSubscriptions(subscriptions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

// 숫자 금액을 한국식 천 단위 구분과 원 단위가 붙은 문자열로 변환한다.
// 예: 13500 -> "13,500원"
function formatCurrency(amount) {
    return `${Number(amount).toLocaleString("ko-KR")}원`;
}

// 현재 날짜를 YYYY-MM-DD 문자열로 반환한다.
// ISO 날짜를 만들기 전에 시간대 차이를 보정해 날짜가 하루 밀리는 것을 막는다.
function getTodayString() {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

// 결제일까지 남은 일수를 화면에 보여줄 문구로 변환한다.
// 0일은 오늘, 음수는 이미 지난 결제일, 양수는 D-day 형식으로 표시한다.
function getDdayLabel(days) {
    if (days === 0) return "오늘 결제";
    if (days < 0) return `${Math.abs(days)}일 지남`;
    return `D-${days}`;
}

// 서비스 이름의 첫 글자를 카드 아이콘에 표시하기 위해 반환한다.
// 이름이 비어 있는 예외 상황에서는 물음표를 사용한다.
function getServiceInitial(name) {
    return name.trim().charAt(0) || "?";
}

// 구독 목록 영역을 다시 그린다.
// 각 구독의 이름, 금액, 결제수단, 카테고리, D-day, 수정/삭제 버튼을 만든다.
function renderSubscriptions(subscriptions) {
    const list = document.querySelector("#subscription-list");
    document.querySelector("#subscription-count").textContent = `${subscriptions.length}개`;

    // 등록된 구독이 없으면 빈 상태 안내 문구만 표시한다.
    if (subscriptions.length === 0) {
        list.innerHTML = '<div class="empty-state">아직 등록된 구독이 없어요.<br>오른쪽에서 첫 구독을 추가해 보세요.</div>';
        return;
    }

    const today = getTodayString();

    // 배열의 각 구독 데이터를 HTML 카드 문자열로 변환한다.
    list.innerHTML = subscriptions.map(subscription => {
        const days = calculateDaysUntilNextPayment(today, subscription.nextPaymentDate);
        const cycleLabel = subscription.cycle === "yearly" ? "매년" : "매월";
        const amountLabel = subscription.cycle === "yearly"
            ? `${formatCurrency(subscription.amount)} / ${cycleLabel}`
            : `${formatCurrency(subscription.amount)} / ${cycleLabel}`;
        return `
            <article class="subscription-card">
                <div class="service-icon">${getServiceInitial(subscription.name)}</div>
                <div class="service-info">
                    <strong>${escapeHtml(subscription.name)}</strong>
                    <span>${escapeHtml(subscription.category)} · ${escapeHtml(subscription.paymentMethod)}</span>
                </div>
                <div class="service-amount">
                    <strong>${amountLabel}</strong>
                    <span class="dday ${days < 0 ? "past" : ""}">${getDdayLabel(days)}</span>
                    <div class="card-actions">
                        <button class="icon-button" type="button" data-action="edit" data-id="${subscription.id}">수정</button>
                        <button class="icon-button" type="button" data-action="delete" data-id="${subscription.id}">삭제</button>
                    </div>
                </div>
            </article>`;
    }).join("");
}

// 상단 요약 영역의 세 가지 숫자를 계산해 화면에 표시한다.
// 월 합계와 연간 합계는 logic.js의 계산 함수를 사용한다.
function renderSummary(subscriptions) {
    const weekly = filterSubscriptionsByNextPayment(subscriptions, getTodayString(), 7).length;
    document.querySelector("#monthly-total").textContent = formatCurrency(calculateTotalMonthlyAmount(subscriptions));
    document.querySelector("#yearly-total").textContent = formatCurrency(calculateTotalYearlyAmount(subscriptions));
    document.querySelector("#upcoming-count").textContent = `${weekly}건`;
}

// 카테고리별 월 지출을 계산하고 막대 그래프로 표시한다.
// 가장 많이 지출하는 카테고리부터 정렬해 보여준다.
function renderCategories(subscriptions) {
    const chart = document.querySelector("#category-chart");
    if (subscriptions.length === 0) {
        chart.innerHTML = '<p class="chart-empty">구독을 추가하면 지출 비중이 표시됩니다.</p>';
        return;
    }
    // logic.js에서 카테고리별 월 합계를 받아 전체 합계를 구한다.
    const totals = groupSubscriptionsByCategory(subscriptions);
    const total = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    const colors = ["#f38d74", "#f4c96b", "#75c9aa", "#8faad9", "#c49bdb"];
    chart.innerHTML = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([category, amount], index) => {
        const percentage = total ? Math.round((amount / total) * 100) : 0;
        return `<div class="category-row">
            <span class="category-name">${escapeHtml(category)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${percentage}%; background:${colors[index % colors.length]}"></div></div>
            <span class="category-value">${percentage}%</span>
        </div>`;
    }).join("");
}

// 사용자가 입력한 문자열을 HTML에 안전하게 넣도록 특수문자를 변환한다.
// 이름이나 카테고리에 HTML 태그가 입력되어도 화면 구조가 깨지지 않는다.
function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
}

// 목록, 상단 요약, 카테고리 그래프를 한 번에 갱신한다.
// 구독을 추가·수정·삭제한 직후 이 함수를 호출한다.
function renderAll(subscriptions) {
    renderSubscriptions(subscriptions);
    renderSummary(subscriptions);
    renderCategories(subscriptions);
}