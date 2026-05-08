const API_URL = "https://script.google.com/macros/s/AKfycbycBFe5dGBFYHAQ3r73dzgzYqBSL1qZbnqusaCUVFiW6vvJQ_8_dA1t5gHhhzyE6uo/exec";

let selectControl;
let base64Items = "";
let base64Doc = "";

document.addEventListener("DOMContentLoaded", async () => {
    selectControl = new TomSelect("#area", {
        create: false,
        sortField: { field: "text", order: "asc" }
    });

    await loadCategories();
});

async function loadCategories() {
    try {
        const res = await fetch(`${API_URL}?action=categories`);
        const data = await res.json();

        const options = data.map(item => ({ value: item, text: item }));
        selectControl.addOptions(options);
    } catch (err) {
        console.error("Failed to load categories", err);
    }
}

function handleFileSelect(evt, type) {
    const file = evt.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        if (type === 'items') {
            base64Items = e.target.result;
            document.getElementById('previewItems').classList.remove('hidden');
            document.getElementById('previewItems').querySelector('img').src = e.target.result;
        } else {
            base64Doc = e.target.result;
            document.getElementById('previewDoc').classList.remove('hidden');
            document.getElementById('previewDoc').querySelector('img').src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

document.getElementById('imageItems').addEventListener('change', (e) => handleFileSelect(e, 'items'));
document.getElementById('imageDoc').addEventListener('change', (e) => handleFileSelect(e, 'doc'));

async function confirmSubmit() {
    const area = document.getElementById('area').value;
    const sender = document.getElementById('sender').value;

    if (!area || !sender) {
        Swal.fire("แจ้งเตือน", "กรุณากรอก AREA และชื่อผู้ส่งให้ครบถ้วน", "warning");
        return;
    }

    const result = await Swal.fire({
        title: 'ยืนยันการส่งข้อมูล?',
        text: "กรุณาตรวจสอบความถูกต้องของข้อมูลและรูปภาพ",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ตกลง, ส่งข้อมูล!',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        submitData();
    }
}

let isSubmitting = false;

async function submitData() {
    if (isSubmitting) return;
    isSubmitting = true;

    const senderValue = document.getElementById('sender').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    if (rememberMe) {
        localStorage.setItem("rememberedSender", senderValue);
    } else {
        localStorage.removeItem("rememberedSender");
    }

    const loadingMessages = [
        "กำลังบันทึก...",
        "กำลังอัปโหลดรูปภาพ (1/2)...",
        "กำลังอัปโหลดรูปภาพ (2/2)...",
        "ใกล้เสร็จแล้ว อีกอึดใจเดียว...",
        "ระบบกำลังประมวลผลข้อมูลหนักเล็กน้อย..."
    ];

    let messageIndex = 0;

    Swal.fire({
        title: loadingMessages[0],
        text: 'ใช้เวลาสักครู่ อยู่ที่ความเร็วอินเตอร์เน็ต',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();

            const timerInterval = setInterval(() => {
                messageIndex++;
                if (messageIndex < loadingMessages.length) {
                    Swal.update({
                        title: loadingMessages[messageIndex]
                    });
                } else {
                    clearInterval(timerInterval);
                }
            }, 4500);

            Swal.timerInterval = timerInterval;
        }
    });

    const payload = {
        action: "create",
        area: document.getElementById('area').value,
        sender: senderValue,
        remark: document.getElementById('remark').value,
        imageItems: base64Items,
        imageDoc: base64Doc
    };

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        clearInterval(Swal.timerInterval);

        if (result.success) {
            await Swal.fire({
                icon: 'success',
                title: 'บันทึกสำเร็จ!',
                text: 'ข้อมูลของคุณถูกเก็บลงระบบแล้ว',
                confirmButtonText: 'ตกลง',
                timer: 2000
            });
            location.reload();
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        clearInterval(Swal.timerInterval);
        isSubmitting = false; 
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถบันทึกได้: ' + err.toString(),
            confirmButtonText: 'รับทราบ'
        });
    }
}
