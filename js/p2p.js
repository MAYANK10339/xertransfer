/**
 * xerTransfer - P2P Engine (PeerJS + WebRTC)
 * Created by: Mayank Mandrai
 * Handles zero-limit chunked file & folder streaming with backpressure.
 */

class XerP2P {
  constructor(options = {}) {
    this.CHUNK_SIZE = 64 * 1024; // 64 KB chunks for safe buffer handling
    this.BUFFER_THRESHOLD = 1024 * 1024 * 4; // 4MB buffer threshold
    this.pin = null;
    this.peer = null;
    this.connection = null;
    this.isSender = false;
    this.options = options;
    
    // Callbacks
    this.onStatus = options.onStatus || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onFileReceived = options.onFileReceived || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});

    // Incoming file state
    this.incomingMeta = null;
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.transferStartTime = 0;
  }

  // Generate 4-Digit PIN
  generatePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // Get full Peer ID mapped to PIN
  getPeerIdFromPin(pin) {
    return `xertransfer-pin-${pin}`;
  }

  // Initialize PeerJS with fallback
  initPeer(peerId = null) {
    return new Promise((resolve, reject) => {
      // Check if running on localhost/render with custom server
      const isLocalOrCustom = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              window.location.port === '3000';

      const peerConfig = isLocalOrCustom ? {
        host: window.location.hostname,
        port: window.location.port ? parseInt(window.location.port) : 80,
        path: '/peerjs',
        secure: window.location.protocol === 'https:',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      } : {
        // Fallback for GitHub Pages / public hosting
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      };

      try {
        if (peerId) {
          this.peer = new Peer(peerId, peerConfig);
        } else {
          this.peer = new Peer(peerConfig);
        }

        this.peer.on('open', (id) => {
          resolve(id);
        });

        this.peer.on('error', (err) => {
          console.error('[PeerJS Error]', err);
          this.onError(err.message || 'P2P Connection Error');
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Setup Sender Mode with 4-Digit PIN
  async startSender() {
    this.isSender = true;
    this.pin = this.generatePin();
    const peerId = this.getPeerIdFromPin(this.pin);

    this.onStatus('Connecting to network...', 'connecting');

    try {
      await this.initPeer(peerId);
      this.onStatus(`Waiting for receiver (PIN: ${this.pin})`, 'ready');

      this.peer.on('connection', (conn) => {
        this.connection = conn;
        this.setupConnectionHandlers();
        this.onStatus('Receiver connected! Ready to transfer.', 'connected');
      });

      return this.pin;
    } catch (err) {
      if (err.type === 'unavailable-id') {
        // Retry with another PIN in case of collision
        return this.startSender();
      }
      throw err;
    }
  }

  // Setup Receiver Mode with Entered PIN
  async startReceiver(pin) {
    this.isSender = false;
    this.pin = pin;
    const targetPeerId = this.getPeerIdFromPin(pin);

    this.onStatus('Connecting to peer...', 'connecting');

    await this.initPeer(); // random ID for receiver

    this.connection = this.peer.connect(targetPeerId, {
      reliable: true
    });

    this.setupConnectionHandlers();
  }

  // Event handlers on Data Connection
  setupConnectionHandlers() {
    this.connection.on('open', () => {
      this.onStatus('Connected directly via WebRTC!', 'connected');
    });

    this.connection.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.connection.on('close', () => {
      this.onStatus('Peer disconnected.', 'disconnected');
    });

    this.connection.on('error', (err) => {
      this.onError('Connection error: ' + err);
    });
  }

  // Handle Received Data (Metadata / Binary Chunks)
  handleIncomingData(data) {
    // 1. Control Packet: Start of a file transfer
    if (data && data.type === 'file-start') {
      this.incomingMeta = data.meta;
      this.receivedChunks = [];
      this.receivedBytes = 0;
      this.transferStartTime = Date.now();
      this.onStatus(`Receiving: ${this.incomingMeta.name}`, 'transferring');
      return;
    }

    // 2. Control Packet: End of current file
    if (data && data.type === 'file-end') {
      if (!this.incomingMeta) return;

      const blob = new Blob(this.receivedChunks, { 
        type: this.incomingMeta.mimeType || 'application/octet-stream' 
      });

      this.onFileReceived(this.incomingMeta, blob);

      // Reset for next file
      this.incomingMeta = null;
      this.receivedChunks = [];
      return;
    }

    // 3. Control Packet: All files completed
    if (data && data.type === 'all-complete') {
      this.onStatus('All files received successfully!', 'connected');
      this.onComplete();
      return;
    }

    // 4. Binary Chunk Packet
    if (data instanceof ArrayBuffer || data.byteLength !== undefined) {
      this.receivedChunks.push(data);
      this.receivedBytes += data.byteLength;

      if (this.incomingMeta) {
        const percent = Math.min(100, Math.round((this.receivedBytes / this.incomingMeta.size) * 100));
        const elapsedSec = (Date.now() - this.transferStartTime) / 1000;
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

  // Send Files & Folders with Backpressure
  async sendFiles(filesList) {
    if (!this.connection || !this.connection.open) {
      this.onError('Receiver not connected yet!');
      return;
    }

    const totalFiles = filesList.length;
    this.onStatus(`Starting transfer of ${totalFiles} item(s)...`, 'transferring');

    for (let i = 0; i < totalFiles; i++) {
      const file = filesList[i];
      const relativePath = file.webkitRelativePath || file.relativePath || file.name;

      // 1. Send File Meta
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

      // 2. Stream Chunks with Backpressure
      await this.streamFileChunks(file, i, totalFiles);

      // 3. Send File End
      this.connection.send({ type: 'file-end' });
    }

    // 4. All Files Complete
    this.connection.send({ type: 'all-complete' });
    this.onStatus('Transfer finished successfully!', 'connected');
    this.onComplete();
  }

  // Chunked FileReader with Backpressure support
  async streamFileChunks(file, fileIndex, totalFiles) {
    let offset = 0;
    const totalSize = file.size;
    const startTime = Date.now();
    const dataChannel = this.connection.dataChannel;

    while (offset < totalSize) {
      // Check WebRTC internal buffer to prevent memory overflow
      if (dataChannel && dataChannel.bufferedAmount > this.BUFFER_THRESHOLD) {
        await this.waitForBufferDrain(dataChannel);
      }

      const slice = file.slice(offset, offset + this.CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();

      this.connection.send(buffer);
      offset += buffer.byteLength;

      const percent = Math.min(100, Math.round((offset / totalSize) * 100));
      const elapsedSec = (Date.now() - startTime) / 1000;
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

  // Wait for WebRTC DataChannel buffer to drop
  waitForBufferDrain(channel) {
    return new Promise((resolve) => {
      const check = () => {
        if (channel.bufferedAmount <= this.CHUNK_SIZE * 4) {
          resolve();
        } else {
          setTimeout(check, 15);
        }
      };
      check();
    });
  }

  // Helpers
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
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
  }
}

window.XerP2P = XerP2P;
