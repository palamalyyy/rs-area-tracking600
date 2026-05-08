const API_URL = "https://script.google.com/macros/s/AKfycbycBFe5dGBFYHAQ3r73dzgzYqBSL1qZbnqusaCUVFiW6vvJQ_8_dA1t5gHhhzyE6uo/exec";
let selectControl, cropper, currentTargetType, isSubmitting = false;
let base64Items = "", base64Doc = "";

document.addEventListener("DOMContentLoaded", async () => {
    selectControl = new TomSelect("#area", { create: false });
    const savedSender = localStorage.getItem("rememberedSender");
    if (savedSender) document.getElementById('sender').value = savedSender;
    await loadCategories();
});

async function loadCategories() {
    const CACHE_KEY = "rs_categories_data";
    const CACHE_TIME_KEY = "rs_categories_timestamp";
    const EXPIRE_TIME = 60 * 1000;

    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();

        if (cachedData && cachedTime && (now - cachedTime < EXPIRE_TIME)) {
            const data = JSON.parse(cachedData);
            renderCategories(data);
            return;
        }

        selectControl.control_input.placeholder = "กำลังโหลด RS AREA...";
        selectControl.disable();

        const res = await fetch(`${API_URL}?action=categories`);
        const data = await res.json();

        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIME_KEY, now.toString());

        renderCategories(data);

    } catch (e) {
        console.error("Error:", e);
        const errorMsg = "โหลดข้อมูลล้มเหลว กรุณาตรวจสอบอินเตอร์เน็ตและรีหน้าเว็บอีกครั้ง";
        selectControl.settings.placeholder = errorMsg;
        selectControl.control_input.placeholder = errorMsg;
        selectControl.sync();
        
        Swal.fire({
            icon: 'error',
            title: 'การโหลดข้อมูลขัดข้อง',
            text: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ URL ของ API',
            confirmButtonText: 'ตกลง'
        });
    }
}

function renderCategories(data) {
    selectControl.clearOptions();
    const options = data.map(i => ({ value: i, text: i }));
    selectControl.addOptions(options);

    const newPlaceholder = "ค้นหาหรือเลือกพื้นที่...";
    selectControl.settings.placeholder = newPlaceholder;
    selectControl.control_input.placeholder = newPlaceholder;
    
    selectControl.clearCache();
    selectControl.sync(); 
    selectControl.enable();
}

function openCropModal(input, type) {
    if (!input.files || !input.files[0]) return;
    currentTargetType = type;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('cropImage');
        img.src = e.target.result;
        
        document.getElementById('cropModal').classList.remove('hidden');
        
        if (cropper) cropper.destroy();
        cropper = new Cropper(img, { 
            viewMode: 1, 
            dragMode: 'move',
            autoCropArea: 1,
            responsive: true,
            center: true,
            restore: false
        });
        input.value = '';
    };
    reader.readAsDataURL(input.files[0]);
}

function closeCropModal() {
    document.getElementById('cropModal').classList.add('hidden');
    if (cropper) cropper.destroy();
}

function applyCrop() {
    const canvas = cropper.getCroppedCanvas({ maxWidth: 1600, maxHeight: 1600, imageSmoothingQuality: 'high' });
    const b64 = canvas.toDataURL('image/jpeg', 0.85);
    if (currentTargetType === 'items') {
        base64Items = b64;
        document.getElementById('previewItems').classList.remove('hidden');
        document.getElementById('previewItems').querySelector('img').src = b64;
    } else {
        base64Doc = b64;
        document.getElementById('previewDoc').classList.remove('hidden');
        document.getElementById('previewDoc').querySelector('img').src = b64;
    }
    closeCropModal();
}

function resetFile(type) {
    if (type === 'items') {
        base64Items = ""; document.getElementById('imageItems').value = "";
        document.getElementById('previewItems').classList.add('hidden');
    } else {
        base64Doc = ""; document.getElementById('imageDoc').value = "";
        document.getElementById('previewDoc').classList.add('hidden');
    }
}

async function confirmSubmit() {
    const area = document.getElementById('area').value;
    const sender = document.getElementById('sender').value;
    if (!area || !sender) return Swal.fire("แจ้งเตือน", "กรุณาระบุพื้นที่และชื่อผู้ส่ง", "warning");
    const res = await Swal.fire({ title: 'ยืนยันการส่ง?', text: "กรุณาตรวจรูปภาพและข้อมูล", icon: 'question', showCancelButton: true });
    if (res.isConfirmed) submitData();
}

async function submitData() {
    if (isSubmitting) return;
    isSubmitting = true;

    const sender = document.getElementById('sender').value;
    if (document.getElementById('rememberMe').checked) {
        localStorage.setItem("rememberedSender", sender);
    }

    const msg = ["กำลังบันทึก...", "อัปโหลดรูปภาพ...", "ประมวลผลขั้นสุดท้าย..."];
    let mi = 0;

    Swal.fire({
        title: msg[0],
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
            const ti = setInterval(() => {
                mi++;
                if (mi < msg.length) Swal.update({ title: msg[mi] });
                else clearInterval(ti);
            }, 4000);
            Swal.ti = ti;
        }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    // ---------------------------------------

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
                action: "create",
                area: document.getElementById('area').value,
                sender,
                remark: document.getElementById('remark').value,
                imageItems: base64Items,
                imageDoc: base64Doc
            })
        });

        const result = await res.json();
        clearTimeout(timeoutId);
        clearInterval(Swal.ti);

        if (result.success) {
            await Swal.fire({ icon: 'success', title: 'สำเร็จ!', timer: 2000 });
            location.reload();
        } else {
            throw new Error(result.message);
        }

    } catch (e) {
        clearTimeout(timeoutId);
        clearInterval(Swal.ti);
        isSubmitting = false;

        let errorMsg = e.toString();
        if (e.name === 'AbortError') {
            errorMsg = "การเชื่อมต่อใช้เวลานานเกินไป (20 วินาที) กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่อีกครั้ง";
        }

        Swal.fire({
            icon: 'error',
            title: 'อัปโหลดล้มเหลว',
            text: errorMsg,
            confirmButtonText: 'ลองอีกครั้ง'
        });
    }
}

