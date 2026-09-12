/**
 * xerTransfer - Main Application Orchestrator
 * Created by: Mayank Mandrai
 */

document.addEventListener('DOMContentLoaded', () => {
  const ui = new XerUI();
  let p2p = null;
  let fileQueue = [];

  // Initialize P2P Client
  function createP2PInstance() {
    if (p2p) p2p.destroy();

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
        ui.showToast('Transfer completed successfully!');
      },
      onError: (err) => {
        ui.showToast(`Error: ${err}`);
        ui.updateStatus('Connection Error', 'error');
      }
    });

    return p2p;
  }

  // --- Tab Navigation ---
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
    fileQueue = fileQueue.concat(newFiles);
    ui.renderFilesList(fileQueue);
  }

  // --- Drag & Drop ---
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
      const files = [];
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

  // Recursive folder reader for drop events
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

  // --- Sender Action: Start Sharing ---
  ui.btnStartShare.addEventListener('click', async () => {
    if (fileQueue.length === 0) {
      ui.showToast('Kripya pehle file ya folder chune!');
      return;
    }

    const client = createP2PInstance();
    try {
      ui.btnStartShare.disabled = true;
      ui.btnStartShare.textContent = 'Generating PIN...';

      const pin = await client.startSender();
      ui.displaySenderPin(pin);

      // Generate Shareable QR URL
      const shareUrl = `${window.location.origin}${window.location.pathname}?pin=${pin}`;
      ui.renderQRCode(shareUrl);

      // Setup connection trigger to auto-stream
      const originalHandler = client.setupConnectionHandlers.bind(client);
      client.setupConnectionHandlers = () => {
        originalHandler();
        // Send files automatically once receiver is connected
        client.connection.on('open', () => {
          setTimeout(() => {
            client.sendFiles(fileQueue);
          }, 600);
        });
      };

      ui.btnStartShare.textContent = 'Waiting for Connection...';
      ui.showToast(`PIN Generated: ${pin}`);
    } catch (err) {
      ui.btnStartShare.disabled = false;
      ui.btnStartShare.textContent = 'Generate PIN & QR';
      ui.showToast('Error creating P2P session');
      console.error(err);
    }
  });

  // --- Receiver Action: Connect with 4-Digit PIN ---
  ui.btnConnectReceiver.addEventListener('click', async () => {
    const pin = ui.getReceiverPin();
    if (!pin || pin.length !== 4) {
      ui.showToast('Kripya 4-digit PIN enter kare!');
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
      ui.showToast(`Connecting to sender (${pin})...`);
    } catch (err) {
      ui.btnConnectReceiver.disabled = false;
      ui.btnConnectReceiver.textContent = 'Connect & Receive';
      ui.showToast('Failed to connect to sender');
      console.error(err);
    }
  }

  // --- Check URL Params for QR Code auto-pairing ---
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl && pinFromUrl.length === 4) {
    ui.receiverTab.click();
    ui.setReceiverPin(pinFromUrl);
    setTimeout(() => {
      connectWithPin(pinFromUrl);
    }, 400);
  }
});
