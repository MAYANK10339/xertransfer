/**
 * xerTransfer - Main Application Orchestrator
 * Created by: Mayank Mandrai
 */

document.addEventListener('DOMContentLoaded', () => {
  const ui = new XerUI();
  let p2p = null;
  let fileQueue = [];

  // Reset button states helper
  function resetActionButtons() {
    if (ui.btnStartShare) {
      ui.btnStartShare.disabled = false;
      ui.btnStartShare.textContent = 'Generate PIN & QR Code';
    }
    if (ui.btnConnectReceiver) {
      ui.btnConnectReceiver.disabled = false;
      ui.btnConnectReceiver.textContent = 'Connect & Receive';
    }
  }

  // Initialize or re-create P2P instance
  function createP2PInstance() {
    if (p2p) {
      p2p.destroy();
    }

    p2p = new XerP2P({
      onStatus: (msg, statusClass) => {
        ui.updateStatus(msg, statusClass);
      },
      onProgress: (data) => {
        ui.updateProgress(data);
      },
      onFileReceived: (meta, blob) => {
        ui.addReceivedFile(meta, blob);
      },
      onComplete: () => {
        ui.showToast('Transfer completed successfully');
        resetActionButtons();
      },
      onError: (err) => {
        ui.showToast(err);
        ui.updateStatus('Connection Error', 'error');
        resetActionButtons();
      }
    });

    return p2p;
  }

  // --- Tab Switching ---
  ui.senderTab.addEventListener('click', () => {
    ui.senderTab.classList.add('active');
    ui.receiverTab.classList.remove('active');
    ui.senderView.classList.add('active');
    ui.receiverView.classList.remove('active');
  });

  ui.receiverTab.addEventListener('click', () => {
    ui.receiverTab.classList.add('active');
    ui.senderTab.classList.remove('active');
    ui.receiverView.classList.add('active');
    ui.senderView.classList.remove('active');
  });

  // --- File & Folder Pickers ---
  ui.filePicker.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
  });

  ui.folderPicker.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
  });

  function appendFiles(newFiles) {
    const formatted = newFiles.map(file => {
      // Ensure webkitRelativePath is preserved
      const relPath = file.webkitRelativePath || file.relativePath || file.name;
      file.relativePath = relPath;
      return file;
    });

    fileQueue = fileQueue.concat(formatted);
    ui.renderFilesList(fileQueue);
  }

  // --- Drag & Drop Handlers ---
  const dropzone = ui.dropzone;
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', async (e) => {
    const items = e.dataTransfer.items;
    if (items) {
      const queue = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (item) queue.push(traverseFileTree(item));
      }
      const results = await Promise.all(queue);
      const flattened = results.flat();
      if (flattened.length > 0) {
        appendFiles(flattened);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFiles(Array.from(e.dataTransfer.files));
    }
  });

  async function traverseFileTree(item, path = '') {
    if (item.isFile) {
      return new Promise((resolve) => {
        item.file((file) => {
          file.relativePath = path + file.name;
          resolve([file]);
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries) => {
          const subQueue = [];
          for (let i = 0; i < entries.length; i++) {
            subQueue.push(traverseFileTree(entries[i], path + item.name + '/'));
          }
          const nested = await Promise.all(subQueue);
          resolve(nested.flat());
        });
      });
    }
    return [];
  }

  // --- Sender: Generate PIN & Share ---
  ui.btnStartShare.addEventListener('click', async () => {
    if (fileQueue.length === 0) {
      ui.showToast('Please select files or folders first');
      return;
    }

    const client = createP2PInstance();
    try {
      ui.btnStartShare.disabled = true;
      ui.btnStartShare.textContent = 'Generating PIN...';

      const pin = await client.startSender();
      ui.displaySenderPin(pin);

      const shareUrl = `${window.location.origin}${window.location.pathname}?pin=${pin}`;
      ui.renderQRCode(shareUrl);

      // Auto-stream to receiver when connected
      const originalHandler = client.setupConnectionHandlers.bind(client);
      client.setupConnectionHandlers = () => {
        originalHandler();
        client.connection.on('open', () => {
          setTimeout(() => {
            client.sendFiles(fileQueue);
          }, 500);
        });
      };

      ui.btnStartShare.textContent = 'Waiting for Receiver...';
      ui.showToast(`Session active: PIN ${pin}`);
    } catch (err) {
      resetActionButtons();
      ui.showToast('Failed to start sender session: ' + err.message);
    }
  });

  // --- Receiver: Connect with PIN ---
  ui.btnConnectReceiver.addEventListener('click', async () => {
    const pin = ui.getReceiverPin();
    if (!pin || pin.length !== 4) {
      ui.showToast('Please enter a 4-digit PIN');
      return;
    }

    connectWithPin(pin);
  });

  async function connectWithPin(pin) {
    const client = createP2PInstance();
    try {
      ui.btnConnectReceiver.disabled = true;
      ui.btnConnectReceiver.textContent = 'Connecting...';
      ui.updateStatus(`Connecting to PIN: ${pin}...`, 'connecting');

      await client.startReceiver(pin);
      ui.showToast(`Searching for PIN ${pin}...`);
    } catch (err) {
      resetActionButtons();
      ui.showToast('Connection failed: ' + err.message);
      ui.updateStatus('Connection failed', 'error');
    }
  }

  // --- Auto-connect if PIN is in query parameter ---
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl && pinFromUrl.length === 4) {
    ui.receiverTab.click();
    ui.setReceiverPin(pinFromUrl);
    setTimeout(() => {
      connectWithPin(pinFromUrl);
    }, 500);
  }
});
