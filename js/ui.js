/**
 * xerTransfer - UI Controller
 * Created by: Mayank Mandrai
 * Handles Themes, Glass Toggle, QR Code, Drag & Drop, and Transfer Progress (Emoji-Free)
 */

class XerUI {
  constructor() {
    this.currentTheme = localStorage.getItem('xer_theme') || 'dark';
    this.isGlassOn = localStorage.getItem('xer_glass') !== 'false';
    this.selectedFiles = [];

    this.initElements();
    this.initThemeAndGlass();
    this.initPinInputs();
  }

  initElements() {
    // Buttons & Controls
    this.themeSelect = document.getElementById('themeSelect');
    this.glassToggleBtn = document.getElementById('glassToggleBtn');
    this.senderTab = document.getElementById('senderTab');
    this.receiverTab = document.getElementById('receiverTab');
    this.senderView = document.getElementById('senderView');
    this.receiverView = document.getElementById('receiverView');

    // Dropzone & Pickers
    this.dropzone = document.getElementById('dropzone');
    this.filePicker = document.getElementById('filePicker');
    this.folderPicker = document.getElementById('folderPicker');
    this.filesPreview = document.getElementById('filesPreview');
    this.selectedFilesList = document.getElementById('selectedFilesList');
    this.btnStartShare = document.getElementById('btnStartShare');

    // Sender Pairing
    this.pairingSection = document.getElementById('pairingSection');
    this.pinDigits = document.querySelectorAll('.pin-digit');
    this.qrContainer = document.getElementById('qrContainer');

    // Receiver Form
    this.receiverPinInputs = document.querySelectorAll('.pin-input-digit');
    this.btnConnectReceiver = document.getElementById('btnConnectReceiver');

    // Progress & Status
    this.statusBadge = document.getElementById('statusBadge');
    this.statusText = document.getElementById('statusText');
    this.statusDot = document.getElementById('statusDot');
    this.transferCard = document.getElementById('transferCard');
    this.progressFill = document.getElementById('progressFill');
    this.transferItemName = document.getElementById('transferItemName');
    this.transferPercent = document.getElementById('transferPercent');
    this.transferSpeed = document.getElementById('transferSpeed');
    this.transferEta = document.getElementById('transferEta');
    this.transferCount = document.getElementById('transferCount');
    this.receivedFilesSection = document.getElementById('receivedFilesSection');
    this.receivedFilesList = document.getElementById('receivedFilesList');

    // Toast
    this.toast = document.getElementById('toast');
  }

  // --- Themes & Glassmorphism ---
  initThemeAndGlass() {
    this.applyTheme(this.currentTheme);
    if (this.themeSelect) {
      this.themeSelect.value = this.currentTheme;
      this.themeSelect.addEventListener('change', (e) => {
        this.applyTheme(e.target.value);
      });
    }

    this.applyGlass(this.isGlassOn);
    if (this.glassToggleBtn) {
      this.glassToggleBtn.addEventListener('click', () => {
        this.toggleGlass();
      });
    }
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('xer_theme', theme);
  }

  applyGlass(isOn) {
    this.isGlassOn = isOn;
    if (isOn) {
      document.body.classList.remove('glass-off');
      this.glassToggleBtn.innerHTML = 'Glass: <b>ON</b>';
      this.glassToggleBtn.classList.add('glass-toggle-active');
    } else {
      document.body.classList.add('glass-off');
      this.glassToggleBtn.innerHTML = 'Glass: <b>OFF</b>';
      this.glassToggleBtn.classList.remove('glass-toggle-active');
    }
    localStorage.setItem('xer_glass', isOn);
  }

  toggleGlass() {
    this.applyGlass(!this.isGlassOn);
    this.showToast(this.isGlassOn ? 'Liquid Glass UI active' : 'Solid performance mode active');
  }

  // --- 4-Digit Receiver Input Auto Advance ---
  initPinInputs() {
    this.receiverPinInputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length === 1 && idx < this.receiverPinInputs.length - 1) {
          this.receiverPinInputs[idx + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          this.receiverPinInputs[idx - 1].focus();
        }
      });
    });
  }

  getReceiverPin() {
    return Array.from(this.receiverPinInputs).map(input => input.value.trim()).join('');
  }

  setReceiverPin(pin) {
    if (!pin || pin.length !== 4) return;
    this.receiverPinInputs.forEach((input, i) => {
      input.value = pin[i] || '';
    });
  }

  // --- Display 4-digit PIN for Sender ---
  displaySenderPin(pin) {
    if (!pin) return;
    const digits = pin.toString().split('');
    this.pinDigits.forEach((el, index) => {
      el.textContent = digits[index] || '-';
    });
    this.pairingSection.classList.add('active');
  }

  // --- Generate QR Code ---
  renderQRCode(text) {
    if (!this.qrContainer) return;
    this.qrContainer.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      new QRCode(this.qrContainer, {
        text: text,
        width: 170,
        height: 170,
        colorDark: '#030712',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      const qrImg = document.createElement('img');
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(text)}`;
      qrImg.alt = 'Scan QR Code';
      this.qrContainer.appendChild(qrImg);
    }
  }

  // --- Selected Files Management ---
  renderFilesList(files) {
    this.selectedFiles = files;
    this.selectedFilesList.innerHTML = '';

    if (files.length === 0) {
      this.filesPreview.style.display = 'none';
      this.btnStartShare.style.display = 'none';
      return;
    }

    this.filesPreview.style.display = 'block';
    this.btnStartShare.style.display = 'inline-flex';

    files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      
      const pathLabel = file.webkitRelativePath || file.name;
      item.innerHTML = `
        <div class="file-meta">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-primary); flex-shrink: 0;">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <div>
            <div class="file-name" title="${pathLabel}">${pathLabel}</div>
            <div class="file-size">${this.formatBytes(file.size)}</div>
          </div>
        </div>
        <button class="remove-file-btn" data-index="${index}" title="Remove">Remove</button>
      `;
      this.selectedFilesList.appendChild(item);
    });

    this.selectedFilesList.querySelectorAll('.remove-file-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        this.selectedFiles.splice(idx, 1);
        this.renderFilesList(this.selectedFiles);
      });
    });
  }

  // --- Transfer Progress Display ---
  updateProgress(data) {
    this.transferCard.classList.add('active');
    this.progressFill.style.width = `${data.percent}%`;
    this.transferItemName.textContent = data.name;
    this.transferPercent.textContent = `${data.percent}%`;
    this.transferSpeed.textContent = `Speed: ${data.speed}`;
    this.transferEta.textContent = `ETA: ${data.eta}`;
    this.transferCount.textContent = `File ${data.currentFile} of ${data.totalFiles}`;
  }

  // --- Add Received File to List ---
  addReceivedFile(meta, blob) {
    if (!this.receivedFiles) this.receivedFiles = [];
    this.receivedFiles.push({ meta, blob });

    this.receivedFilesSection.style.display = 'block';
    
    // Check if we have multiple files or folder structure to show "Download Folder ZIP" button
    const hasSubfolders = this.receivedFiles.some(f => f.meta.relativePath && f.meta.relativePath.includes('/'));
    let zipBtn = document.getElementById('btnDownloadZip');
    if ((this.receivedFiles.length > 1 || hasSubfolders) && !zipBtn) {
      zipBtn = document.createElement('button');
      zipBtn.id = 'btnDownloadZip';
      zipBtn.className = 'btn-primary';
      zipBtn.style.marginBottom = '14px';
      zipBtn.style.width = '100%';
      zipBtn.style.justifyContent = 'center';
      zipBtn.textContent = 'Download Entire Folder Structure (.ZIP)';
      zipBtn.addEventListener('click', () => this.downloadAllAsZip());
      this.receivedFilesList.parentNode.insertBefore(zipBtn, this.receivedFilesList);
    }

    const item = document.createElement('div');
    item.className = 'file-item';

    const downloadUrl = URL.createObjectURL(blob);
    const displayPath = meta.relativePath || meta.name;

    item.innerHTML = `
      <div class="file-meta">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-primary); flex-shrink: 0;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <div>
          <div class="file-name" title="${displayPath}">${displayPath}</div>
          <div class="file-size">${this.formatBytes(meta.size)}</div>
        </div>
      </div>
      <a href="${downloadUrl}" download="${meta.name}" class="btn-primary" style="padding: 6px 16px; font-size: 0.82rem; text-decoration: none;">
        Download
      </a>
    `;

    this.receivedFilesList.appendChild(item);

    // Auto-trigger single file download if not a folder collection
    if (!hasSubfolders && this.receivedFiles.length === 1) {
      const autoLink = document.createElement('a');
      autoLink.href = downloadUrl;
      autoLink.download = meta.name;
      document.body.appendChild(autoLink);
      autoLink.click();
      document.body.removeChild(autoLink);
    }

    this.showToast(`Received: ${displayPath}`);
  }

  // --- Download Entire Folder as ZIP with Sub-folders ---
  async downloadAllAsZip() {
    if (!window.JSZip || !this.receivedFiles || this.receivedFiles.length === 0) {
      this.showToast('No files to zip');
      return;
    }

    const zipBtn = document.getElementById('btnDownloadZip');
    if (zipBtn) {
      zipBtn.disabled = true;
      zipBtn.textContent = 'Generating Folder ZIP...';
    }

    const zip = new JSZip();
    this.receivedFiles.forEach(item => {
      const fullPath = item.meta.relativePath || item.meta.name;
      zip.file(fullPath, item.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'xertransfer_folder.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (zipBtn) {
      zipBtn.disabled = false;
      zipBtn.textContent = 'Download Entire Folder Structure (.ZIP)';
    }
    this.showToast('Folder downloaded as ZIP');
  }

  // --- Status Badge ---
  updateStatus(text, dotClass = '') {
    this.statusText.textContent = text;
    this.statusDot.className = 'status-dot ' + dotClass;
  }

  // --- Toast Notification ---
  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3200);
  }

  // --- Format Bytes ---
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

window.XerUI = XerUI;
