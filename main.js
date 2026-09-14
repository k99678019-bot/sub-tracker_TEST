let subscriptions = loadSubscriptions();

const form = document.querySelector("#subscription-form");
const cancelButton = document.querySelector("#cancel-button");

// 입력 폼을 새 구독 추가 상태로 되돌린다.
// 수정 중이었다면 숨은 ID와 버튼 문구도 함께 초기화한다.
function resetForm() {
    form.reset();
    document.querySelector("#subscription-id").value = "";
    document.querySelector("#form-title").textContent = "새 구독 추가";
    document.querySelector("#submit-button").textContent = "구독 추가";
    cancelButton.classList.add("hidden");
}

// 선택한 구독의 값을 폼에 채워 수정 상태로 전환한다.
// id로 목록에서 구독을 찾지 못하면 아무 작업도 하지 않는다.
function startEdit(id) {
    const subscription = subscriptions.find(item => item.id === id);
    if (!subscription) return;
    document.querySelector("#subscription-id").value = subscription.id;
    document.querySelector("#name").value = subscription.name;
    document.querySelector("#amount").value = subscription.amount;
    document.querySelector("#cycle").value = subscription.cycle;
    document.querySelector("#nextPaymentDate").value = subscription.nextPaymentDate;
    document.querySelector("#category").value = subscription.category;
    document.querySelector("#paymentMethod").value = subscription.paymentMethod;
    document.querySelector("#form-title").textContent = "구독 수정";
    document.querySelector("#submit-button").textContent = "수정 저장";
    cancelButton.classList.remove("hidden");
    document.querySelector("#name").focus();
}

// 확인창에서 사용자가 삭제를 승인한 구독을 목록과 localStorage에서 제거한다.
// 삭제 직후 화면 전체를 다시 그려 카드와 요약을 최신 상태로 만든다.
function deleteSubscription(id) {
    const subscription = subscriptions.find(item => item.id === id);
    if (!subscription || !window.confirm(`${subscription.name} 구독을 삭제할까요?`)) return;
    subscriptions = subscriptions.filter(item => item.id !== id);
    saveSubscriptions(subscriptions);
    renderAll(subscriptions);
}

// 폼 제출 이벤트를 처리한다.
// 숨은 ID가 있으면 기존 구독을 수정하고, 없으면 새 ID를 만들어 추가한다.
form.addEventListener("submit", event => {
    // 브라우저의 기본 제출(페이지 새로고침)을 막고 입력값을 읽는다.
    event.preventDefault();
    const formData = new FormData(form);
    const existingId = formData.get("subscription-id");
    const subscription = {
        id: existingId || `sub_${Date.now()}`,
        name: formData.get("name").trim(),
        amount: Number(formData.get("amount")),
        cycle: formData.get("cycle"),
        nextPaymentDate: formData.get("nextPaymentDate"),
        category: formData.get("category").trim(),
        paymentMethod: formData.get("paymentMethod").trim()
    };

    // 기존 ID가 있으면 같은 ID의 항목만 교체한다.
    if (existingId) {
        subscriptions = subscriptions.map(item => item.id === existingId ? subscription : item);
    } else {
        subscriptions.push(subscription);
    }
    // 변경 내용을 저장한 뒤 화면을 갱신하고 폼을 초기화한다.
    saveSubscriptions(subscriptions);
    renderAll(subscriptions);
    resetForm();
});

// 수정 취소 버튼을 누르면 입력 중인 값을 버리고 추가 상태로 돌아간다.
cancelButton.addEventListener("click", resetForm);

// 목록의 상위 요소 하나에서 수정/삭제 버튼 클릭을 위임해서 처리한다.
// 동적으로 새로 만들어진 카드의 버튼에도 같은 이벤트가 적용된다.
document.querySelector("#subscription-list").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") startEdit(button.dataset.id);
    if (button.dataset.action === "delete") deleteSubscription(button.dataset.id);
});

// 페이지가 열릴 때 저장된 데이터를 화면에 최초로 표시한다.
renderAll(subscriptions);