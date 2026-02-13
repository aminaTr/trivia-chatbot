class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.BUFFER_SIZE = 1024; // ~64ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const data = input[0];

    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data[i]);
    }

    if (this.buffer.length >= this.BUFFER_SIZE) {
      const chunk = this.buffer.splice(0, this.BUFFER_SIZE);
      const int16 = new Int16Array(chunk.length);

      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
