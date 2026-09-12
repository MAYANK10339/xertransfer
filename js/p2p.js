/**
 * xerTransfer - P2P Engine (PeerJS + WebRTC)
 * Created by: Mayank Mandrai
 * Non-blocking, zero-limit chunked file & folder streaming with watchdog timeouts.
 */

class XerP2P {
  constructor(options = {}) {
    this.CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
    this.BUFFER_THRESHOLD = 1024 * 1024 * 2; // 2MB backpressure buffer
    this.CONNECTION_TIMEOUT = 12000; // 12 seconds connection watchdog

    this.pin = null;
    this.peer = null;
    this.connection = null;
    this.isSender = false;
    this.connectWatchdog = null;
    this.options = options;

    // Callbacks
    this.onStatus = options.onStatus || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onFileReceived = options.onFileReceived || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});

    // Incoming transfer state
    this.incomingMeta = null;
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.transferStartTime = 0;
  }

  // Generate clean 4-digit PIN
  generatePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  getPeerIdFromPin(pin) {
    return `xertransfer-v2-${pin}`;
  }

  // Clear watchdog timer
  clearWatchdog() {
    if (this.connectWatchdog) {
      clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
  }

  // Initialize PeerJS with fallback configuration and timeout protection
  async initPeer(peerId = null) {
    this.destroy(); // Clean previous instance if any

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
          }
          reject(new Error('Network connection timed out. Check your internet connection.'));
        }
      }, 10000);

      // Resilient STUN configuration
      const config = {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.services.mozilla.com' }
          ]
        }
      };

      try {
        this.peer = peerId ? new Peer(peerId, config) : new Peer(config);

        this.peer.on('open', (id) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            resolve(id);
          }
        });

        this.peer.on('error', (err) => {
          console.warn('[PeerJS]', err.type, err.message);
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            reject(err);
          } else {
            this.onError(this.formatErrorMessage(err));
          }
        });

        this.peer.on('disconnected', () => {
          console.warn('[PeerJS] Disconnected from signaling server');
        });
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  // Sender initialization
  async startSender() {
    this.isSender = true;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      this.pin = this.generatePin();
      const peerId = this.getPeerIdFromPin(this.pin);

      this.onStatus('Creating secure P2P session...', 'connecting');

      try {
        await this.initPeer(peerId);
        this.onStatus(`PIN Ready: ${this.pin}. Waiting for receiver...`, 'ready');

        this.peer.on('connection', (conn) => {
          this.connection = conn;
          this.setupConnectionHandlers();
          this.onStatus('Receiver paired directly. Ready to transfer.', 'connected');
        });

        return this.pin;
      } catch (err) {
        if (err.type === 'unavailable-id' && attempts < maxAttempts) {
          // Retry with new PIN
          continue;
        }
        throw new Error(this.formatErrorMessage(err));
      }
    }
  }

  // Receiver initialization with watchdog
  async startReceiver(pin) {
    this.isSender = false;
    this.pin = pin;
    const targetPeerId = this.getPeerIdFromPin(pin);

    this.onStatus('Connecting to signaling network...', 'connecting');
    await this.initPeer(); // Create receiver peer

    this.onStatus(`Searching for sender PIN ${pin}...`, 'connecting');

    this.connection = this.peer.connect(targetPeerId, {
      reliable: true
    });

    this.setupConnectionHandlers();

    // Watchdog timer: prevent infinite freeze in 'connecting' phase
    this.clearWatchdog();
    this.connectWatchdog = setTimeout(() => {
      if (!this.connection || !this.connection.open) {
        this.destroy();
        this.onError(`Could not connect to PIN ${pin}. Please verify sender PIN and try again.`);
      }
    }, this.CONNECTION_TIMEOUT);
  }

  // Connection Event Handlers
  setupConnectionHandlers() {
    if (!this.connection) return;

    this.connection.on('open', () => {
      this.clearWatchdog();
      this.onStatus('Direct WebRTC connection established.', 'connected');
    });

    this.connection.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.connection.on('close', () => {
      this.clearWatchdog();
      this.onStatus('P2P connection closed.', '');
    });

    this.connection.on('error', (err) => {
      this.clearWatchdog();
      console.error('[Connection Error]', err);
      this.onError('P2P DataChannel error: ' + (err.message || err));
    });
  }

  // Handle Received Data Packets
  handleIncomingData(data) {
    if (data && data.type === 'file-start') {
      this.incomingMeta = data.meta;
      this.receivedChunks = [];
      this.receivedBytes = 0;
      this.transferStartTime = performance.now();
      this.onStatus(`Receiving: ${this.incomingMeta.name}`, 'transferring');
      return;
    }

    if (data && data.type === 'file-end') {
      if (!this.incomingMeta) return;

      const blob = new Blob(this.receivedChunks, {
        type: this.incomingMeta.mimeType || 'application/octet-stream'
      });

      this.onFileReceived(this.incomingMeta, blob);

      this.incomingMeta = null;
      this.receivedChunks = [];
      return;
    }

    if (data && data.type === 'all-complete') {
      this.onStatus('All files transferred successfully.', 'connected');
      this.onComplete();
      return;
    }

    // Binary Chunk
    if (data instanceof ArrayBuffer || (data && data.byteLength !== undefined)) {
      this.receivedChunks.push(data);
      this.receivedBytes += data.byteLength;

      if (this.incomingMeta) {
        const percent = Math.min(100, Math.round((this.receivedBytes / this.incomingMeta.size) * 100));
        const elapsedSec = (performance.now() - this.transferStartTime) / 1000;
        const speed = elapsedSec > 0 ? this.receivedBytes / elapsedSec : 0;
        const remainingBytes = this.incomingMeta.size - this.receivedBytes;
        const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

        this.onProgress({
          name: this.incomingMeta.name,
          currentFile: this.incomingMeta.index + 1,
          totalFiles: this.incomingMeta.totalFiles,
          percent: percent,
          speed: this.formatSpeed(speed),
          eta: this.formatEta(eta),
          transferredBytes: this.receivedBytes,
          totalBytes: this.incomingMeta.size
        });
      }
    }
  }

  // Send Files Non-blockingly (Yielder pattern for smooth UI)
  async sendFiles(filesList) {
    if (!this.connection || !this.connection.open) {
      this.onError('Receiver is not connected.');
      return;
    }

    const totalFiles = filesList.length;
    this.onStatus(`Transferring ${totalFiles} file(s)...`, 'transferring');

    for (let i = 0; i < totalFiles; i++) {
      const file = filesList[i];
      const relativePath = file.webkitRelativePath || file.relativePath || file.name;

      // 1. File Start Packet
      this.connection.send({
        type: 'file-start',
        meta: {
          index: i,
          totalFiles: totalFiles,
          name: file.name,
          relativePath: relativePath,
          size: file.size,
          mimeType: file.type
        }
      });

      // 2. Stream chunks asynchronously
      await this.streamFileChunks(file, i, totalFiles);

      // 3. File End Packet
      this.connection.send({ type: 'file-end' });
    }

    // 4. All Complete
    this.connection.send({ type: 'all-complete' });
    this.onStatus('Transfer finished successfully.', 'connected');
    this.onComplete();
  }

  // Non-blocking file chunk streaming
  async streamFileChunks(file, fileIndex, totalFiles) {
    let offset = 0;
    const totalSize = file.size;
    const startTime = performance.now();
    const dataChannel = this.connection.dataChannel;
    let chunkCounter = 0;

    while (offset < totalSize) {
      // 1. Check WebRTC buffer backpressure
      if (dataChannel && dataChannel.bufferedAmount > this.BUFFER_THRESHOLD) {
        await this.waitForBufferDrain(dataChannel);
      }

      // 2. Read Slice
      const slice = file.slice(offset, offset + this.CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();

      // 3. Send
      this.connection.send(buffer);
      offset += buffer.byteLength;
      chunkCounter++;

      // 4. NON-BLOCKING UI THREAD YIELD (Every 4 chunks)
      // This prevents the browser UI from freezing during transfers!
      if (chunkCounter % 4 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // 5. Progress Calculation
      const percent = Math.min(100, Math.round((offset / totalSize) * 100));
      const elapsedSec = (performance.now() - startTime) / 1000;
      const speed = elapsedSec > 0 ? offset / elapsedSec : 0;
      const remainingBytes = totalSize - offset;
      const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

      this.onProgress({
        name: file.name,
        currentFile: fileIndex + 1,
        totalFiles: totalFiles,
        percent: percent,
        speed: this.formatSpeed(speed),
        eta: this.formatEta(eta),
        transferredBytes: offset,
        totalBytes: totalSize
      });
    }
  }

  // Drain buffer
  waitForBufferDrain(channel) {
    return new Promise((resolve) => {
      const check = () => {
        if (!channel || channel.bufferedAmount <= this.CHUNK_SIZE * 4) {
          resolve();
        } else {
          setTimeout(check, 12);
        }
      };
      check();
    });
  }

  formatErrorMessage(err) {
    if (!err) return 'Unknown connection error';
    if (err.type === 'peer-unavailable') return 'Sender PIN not found or expired.';
    if (err.type === 'network') return 'Network issue connecting to signaling server.';
    if (err.type === 'server-error') return 'Signaling server unreachable.';
    return err.message || err.toString();
  }

  formatSpeed(bytesPerSec) {
    if (bytesPerSec > 1024 * 1024) {
      return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
    }
    return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
  }

  formatEta(seconds) {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  destroy() {
    this.clearWatchdog();
    if (this.connection) {
      try { this.connection.close(); } catch (e) {}
      this.connection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
  }
}

window.XerP2P = XerP2P;
