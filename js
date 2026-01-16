// 配置：你的Cloudflare Worker地址（必须修改）
const WORKER_API_URL = "https://shop-api.wo785655730.workers.dev/";

// DOM元素引用
const orderIdInput = document.getElementById('orderId');
const verifyBtn = document.getElementById('verifyBtn');
const statusSection = document.getElementById('statusSection');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const statusIcon = document.getElementById('statusIcon');
const progressContainer = document.getElementById('progressContainer');
const downloadProgress = document.getElementById('downloadProgress');
const progressPercent = document.getElementById('progressPercent');
const captchaText = document.getElementById('captchaText');
const captchaInput = document.getElementById('captchaInput');
const refreshCaptcha = document.getElementById('refreshCaptcha');

// 状态管理
let currentStep = 1;
let generatedCaptcha = '';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    generateCaptcha();
    setupEventListeners();
});

// 生成随机验证码
function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    generatedCaptcha = '';
    for (let i = 0; i < 4; i++) {
        generatedCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    captchaText.textContent = generatedCaptcha;
}

// 设置事件监听器
function setupEventListeners() {
    // 验证码刷新
    refreshCaptcha.addEventListener('click', generateCaptcha);
    
    // 订单号输入实时验证
    orderIdInput.addEventListener('input', function() {
        const value = this.value.trim();
        const isValid = /^\d{18}$/.test(value);
        
        if (value.length === 18 && !isValid) {
            showInputError('订单号必须为18位数字');
        } else {
            clearInputError();
        }
    });
    
    // 回车键提交
    orderIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyOrder();
        }
    });
}

// 显示输入错误
function showInputError(message) {
    const inputGroup = orderIdInput.parentElement;
    if (!inputGroup.querySelector('.error-message')) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorEl.style.color = 'var(--danger-color)';
        errorEl.style.fontSize = '14px';
        errorEl.style.marginTop = '8px';
        errorEl.style.display = 'flex';
        errorEl.style.alignItems = 'center';
        errorEl.style.gap = '8px';
        inputGroup.appendChild(errorEl);
    }
    orderIdInput.style.borderColor = 'var(--danger-color)';
}

// 清除输入错误
function clearInputError() {
    const inputGroup = orderIdInput.parentElement;
    const errorEl = inputGroup.querySelector('.error-message');
    if (errorEl) {
        errorEl.remove();
    }
    orderIdInput.style.borderColor = 'var(--light-gray)';
}

// 清空输入
function clearInput() {
    orderIdInput.value = '';
    captchaInput.value = '';
    clearInputError();
    orderIdInput.focus();
}

// 更新进度步骤
function updateProgressStep(step) {
    const steps = document.querySelectorAll('.step');
    const progressFill = document.querySelector('.progress-fill');
    
    steps.forEach((s, index) => {
        if (index + 1 <= step) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });
    
    // 更新进度条宽度
    const width = (step / 3) * 100;
    progressFill.style.width = `${width}%`;
    currentStep = step;
}

// 显示状态
function showStatus(type, title, message) {
    statusSection.style.display = 'block';
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    
    // 根据类型设置图标和颜色
    const icons = {
        loading: 'fas fa-spinner fa-spin',
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle'
    };
    
    const colors = {
        loading: 'var(--primary-color)',
        success: 'var(--success-color)',
        error: 'var(--danger-color)',
        warning: 'var(--warning-color)'
    };
    
    statusIcon.className = icons[type] || icons.loading;
    statusIcon.style.color = colors[type] || colors.loading;
    
    // 滚动到状态区域
    statusSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 更新下载进度
function updateDownloadProgress(percent) {
    progressContainer.style.display = 'block';
    downloadProgress.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
}

// 主验证函数
async function verifyOrder() {
    // 获取输入值
    const orderId = orderIdInput.value.trim();
    const userCaptcha = captchaInput.value.trim().toUpperCase();
    
    // 验证输入
    if (!orderId) {
        showInputError('请输入订单号');
        return;
    }
    
    if (!/^\d{18}$/.test(orderId)) {
        showInputError('订单号必须为18位数字');
        return;
    }
    
    if (!userCaptcha) {
        alert('请输入验证码');
        captchaInput.focus();
        return;
    }
    
    if (userCaptcha !== generatedCaptcha) {
        alert('验证码不正确，请重新输入');
        generateCaptcha();
        captchaInput.value = '';
        captchaInput.focus();
        return;
    }
    
    // 禁用按钮防止重复点击
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 验证中...';
    
    // 更新进度
    updateProgressStep(2);
    showStatus('loading', '正在验证订单', '正在与服务器通信，验证您的订单信息...');
    
    try {
        // 第一步：验证订单
        const verifyResponse = await fetch(`${WORKER_API_URL}/api/verify`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderId: orderId })
        });
        
        const result = await verifyResponse.json();
        
        if (!result.success) {
            throw new Error(result.message || '订单验证失败');
        }
        
        const { token, fileKey } = result;
        
        // 更新状态
        updateProgressStep(3);
        showStatus('success', '验证成功', '订单验证通过！正在准备文件下载...');
        
        // 显示下载进度
        updateDownloadProgress(30);
        
        // 第二步：下载文件
        const downloadResponse = await fetch(`${WORKER_API_URL}/api/download/${fileKey}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!downloadResponse.ok) {
            throw new Error(`下载失败: ${downloadResponse.status}`);
        }
        
        // 获取文件大小（如果支持）
        const contentLength = downloadResponse.headers.get('content-length');
        let loaded = 0;
        
        // 创建读取流来跟踪进度
        const reader = downloadResponse.body.getReader();
        const chunks = [];
        let total = contentLength ? parseInt(contentLength) : 0;
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;
            
            // 更新进度（如果有总大小）
            if (total) {
                const percent = Math.min(100, Math.round((loaded / total) * 100));
                updateDownloadProgress(30 + percent * 0.7); // 从30%开始
            } else {
                // 模拟进度
                updateDownloadProgress(30 + Math.min(70, chunks.length * 10));
            }
        }
        
        // 合并数据
        const blob = new Blob(chunks);
        updateDownloadProgress(100);
        
        // 创建下载
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileKey;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        // 最终状态
        setTimeout(() => {
            showStatus('success', '下载完成', '文件已开始下载！如果浏览器没有自动下载，请检查下载文件夹或浏览器设置。');
            
            // 重置按钮和表单
            setTimeout(() => {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '<span class="btn-text">立即验证并下载</span><i class="fas fa-arrow-right btn-icon"></i>';
                clearInput();
                generateCaptcha();
                progressContainer.style.display = 'none';
                updateProgressStep(1);
            }, 3000);
        }, 500);
        
    } catch (error) {
        console.error('下载过程出错:', error);
        
        // 错误状态
        updateProgressStep(1);
        showStatus('error', '操作失败', `错误: ${error.message || '请检查网络连接后重试'}`);
        
        // 重置按钮
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<span class="btn-text">立即验证并下载</span><i class="fas fa-arrow-right btn-icon"></i>';
        
        // 重置进度
        progressContainer.style.display = 'none';
        updateDownloadProgress(0);
    }
}
